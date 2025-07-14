import { Storage } from "@plasmohq/storage"

import { createBookmark } from "~background-service/sync-bookmark"
import { FUNC_NAME } from "~constant/functionName"
import { supabase } from "~core/supabase"
import { askAndProvideCallingFunc } from "~utils/askAndProvideFunc"
import { getAllBookmarkUrls } from "~utils/bookmarkHelpers"
import { getUserId } from "~utils/getUserId"
import { semanticSearch } from "~utils/supabase-queries/semanticSearch"

import type { BookmarkType } from "./utils/bookmarkHelpers"
import { searchByTagName } from "./utils/supabase-queries/searchByTagName"

const storage = new Storage({
  area: "local"
})

supabase.auth.onAuthStateChange(async (event, session) => {
  const userId = await getUserId()
  if (event === "SIGNED_OUT") {
    await storage.setItem("user", null)
  } else if (!userId || userId != session?.user?.id) {
    await storage.setItem("user", session?.user)
  }
})

// Lắng nghe tin nhắn từ content script hoặc side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ASK") {
    ;(async () => {
      const { userId, question } = request.payload
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
            const data = await semanticSearch(userId, textSearch)
            sendResponse({
              success: true,
              data
            })
            break
          }
        }
      } catch (error) {
        console.log(error, "call semantic search")
        const data = await semanticSearch(userId, question)
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

      await storage.setItem("unsyncBookmarks", bookmarksToSync)
    })()
  }
  if (request.action === "SYNC") {
    ;(async () => {
      const syncBookmarks =
        await storage.getItem<BookmarkType[]>("unsyncBookmarks")
      for (const bm of syncBookmarks) {
      }
    })()
  }
})

// catch bookmark event
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  console.log("Bookmark mới được tạo:", id, bookmark)
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
  console.log("Process xoá bookmark id:", id)
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
