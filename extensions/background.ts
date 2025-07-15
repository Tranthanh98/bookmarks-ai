import { Storage } from "@plasmohq/storage"

import { createBookmark } from "~background-service/sync-bookmark"
import { FUNC_NAME } from "~constant/functionName"
import { MATCH_THRESHOLD } from "~constant/matchThreshold"
import { STORAGE_KEYS } from "~constant/storageKeys"
import { supabase } from "~core/supabase"
import { askAndProvideCallingFunc } from "~utils/askAndProvideFunc"
import { getAllBookmarkUrls } from "~utils/bookmarkHelpers"
import { getUserId } from "~utils/getUserId"
import { sleep } from "~utils/sleep"
import { semanticSearch } from "~utils/supabase-queries/semanticSearch"

import type { BookmarkType } from "./utils/bookmarkHelpers"
import { searchByTagName } from "./utils/supabase-queries/searchByTagName"

const storage = new Storage({
  area: "local"
})

const getSyncStatus = async () => {
  return (await storage.getItem(STORAGE_KEYS.SyncStatus)) ?? false
}

supabase.auth.onAuthStateChange(async (event, session) => {
  const userId = await getUserId()
  if (event === "SIGNED_OUT") {
    await storage.setItem(STORAGE_KEYS.User, null)
  } else if (!userId || userId != session?.user?.id) {
    await storage.setItem(STORAGE_KEYS.User, session?.user)
  }
})

// Lắng nghe tin nhắn từ content script hoặc side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ASK") {
    ;(async () => {
      const { userId, question, match_threshold } = request.payload
      try {
        const functionCall = await askAndProvideCallingFunc(question)
        if (!functionCall)
          throw new Error(
            "Dữ liệu không trích xuất được function, call semantic search"
          )
        const functionName = functionCall.name

        switch (functionName) {
          case FUNC_NAME.SearchByTagName: {
            const tagName = functionCall.args.tagName
            const data = await searchByTagName(userId, tagName)
            sendResponse({
              success: true,
              data
            })
            break
          }
          case FUNC_NAME.SemanticSearch: {
            const textSearch = functionCall.args.textSearch
            const data = await semanticSearch(
              userId,
              textSearch,
              match_threshold ?? MATCH_THRESHOLD.MEDIUM
            )
            sendResponse({
              success: true,
              data
            })
            break
          }
        }
      } catch (error) {
        console.log(error, "call semantic search")
        const data = await semanticSearch(
          userId,
          question,
          match_threshold ?? MATCH_THRESHOLD.MEDIUM
        )
        sendResponse({
          success: true,
          data
        })
      }
    })()

    return true
  }
  if (request.action === "INIT_SYNC") {
    ;(async () => {
      const userId = await getUserId()
      if (!userId) return

      const chromeBookmarkUrls = new Set<BookmarkType>()
      const tree = await chrome.bookmarks.getTree()
      getAllBookmarkUrls(tree, chromeBookmarkUrls)

      console.log("getUserId", userId)

      // 2. Lấy tất cả URLs đã lưu trong Supabase cho user hiện tại
      const { data: supabaseBookmarks, error: supabaseError } = await supabase
        .from("bookmarks")
        .select("url")
        .eq("user_id", userId)

      if (supabaseError) {
        console.error("Lỗi khi lấy bookmarks từ Supabase:", supabaseError)
        sendResponse({ status: "error", error: supabaseError.message })
        return true // Giữ cổng tin nhắn mở
      }

      const supabaseUrls = new Set<string>(supabaseBookmarks.map((b) => b.url))

      // 3. Xác định các bookmark chưa được lưu
      const bookmarksToSync: BookmarkType[] = []
      for (const browserBookmark of chromeBookmarkUrls) {
        if (!supabaseUrls.has(browserBookmark.url)) {
          bookmarksToSync.push({ ...browserBookmark })
        }
      }

      await storage.setItem(STORAGE_KEYS.UnsyncBookmarks, bookmarksToSync)
    })()
  }
  if (request.action === "SYNC_BOOKMARKS") {
    ;(async () => {
      const syncStatus = await getSyncStatus()
      console.log("syncStatus", syncStatus)
      if (syncStatus) {
        console.log("being syncning")
        return
      }

      const unsyncBookmarks = await storage.getItem<BookmarkType[]>(
        STORAGE_KEYS.UnsyncBookmarks
      )

      if (unsyncBookmarks?.length === 0) {
        await storage.setItem(STORAGE_KEYS.SyncStatus, false)
        return
      }

      await storage.setItem(STORAGE_KEYS.SyncStatus, true)

      let isContinueLoop = true

      const successSyncs = []

      for (const bm of unsyncBookmarks) {
        if (!isContinueLoop) break
        try {
          await createBookmark(bm.id, { ...bm })
          successSyncs.push(bm)
          await sleep(2000)
        } catch (err) {
          console.log("failed at", err, bm)
          await storage.setItem(STORAGE_KEYS.SyncStatus, false)
          isContinueLoop = false
        }
      }

      const remainingSyncs = unsyncBookmarks.filter(
        (i) => !successSyncs.includes(i)
      )

      await storage.setItem(STORAGE_KEYS.UnsyncBookmarks, remainingSyncs)
    })()
  }
})

// catch bookmark event
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  ;(async () => {
    await createBookmark(id, {
      id: id,
      title: bookmark.title,
      url: bookmark.url,
      parendId: bookmark.parentId
    })
  })()
})

chrome.bookmarks.onRemoved.addListener(async (id) => {
  const userId = await getUserId()

  const { error } = await supabase
    .from("bookmarks")
    .update({
      is_delete: true,
      updated_at: new Date()
    })
    .eq("browser_bookmark_id", id)
    .eq("user_id", userId)
  if (error) {
    console.error("Xoá bookmark bị lỗi", error.message)
  }
})
