import { FUNC_NAME } from "~constant/functionName"
import { supabase } from "~core/supabase"
import { askAndProvideCallingFunc } from "~utils/askAndProvideFunc"
import { generateEmbedding } from "~utils/embeddingingText"
import { summarizeAndExtractKeyInfo } from "~utils/summarizeAndExtractKeyInfo"
import { semanticSearch } from "~utils/supabase-queries/semanticSearch"

import { searchByTagName } from "./utils/supabase-queries/searchByTagName"

// Khóa API
const API_KEY = process.env.PLASMO_PUBLIC_GEMINI_API_KEY

// Lắng nghe tin nhắn từ content script hoặc side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ASK") {
    ;(async () => {
      try {
        const { userId, question } = request.payload
        const functionCall = await askAndProvideCallingFunc(question)
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
        console.error(error)
        sendResponse({
          success: false,
          error
        })
      }
    })()

    return true
  }
  if (request.action === "ON_BOOKMARKED") {
    sendResponse({ success: true, refactoredText: request.message })
  }
})

// Thiết lập bảng điều khiển bên chỉ mở cho các tab cụ thể
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Set panel behavior error:", error))
})
// catch bookmark event
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log("Bookmark mới được tạo:", id, bookmark)
  const userId = (await supabase.auth.getUser()).data.user.id
  if (bookmark.url) {
    try {
      // 2. Tóm tắt và trích xuất thông tin chính bằng Gemini API
      const { summary, key_info } = await summarizeAndExtractKeyInfo(
        bookmark.url
      )
      console.log("Tóm tắt:", summary)

      // 3. Tạo embedding cho tóm tắt
      const embedding = await generateEmbedding(summary)

      console.log("Embedding được tạo.")
      // 4. Lưu vào Supabase

      const { data: bookmarkData, error } = await supabase
        .from("bookmarks")
        .insert([
          {
            user_id: userId, // Thay thế bằng ID người dùng thực tế
            url: bookmark.url,
            title: bookmark.title,
            summary: summary,
            key_info: key_info,
            embedding: embedding,
            browser_bookmark_id: id
          }
        ])
        .select()
        .maybeSingle()

      const { error: errorTags } = await supabase.rpc("insert_bookmark_tags", {
        p_bookmark_id: bookmarkData.id,
        p_user_id: userId,
        p_tag_names: key_info.keywords
      })

      if (error) {
        console.error("Lỗi khi lưu bookmark vào Supabase:", error)
      } else {
        console.log(
          "Bookmark đã được lưu thành công vào Supabase:",
          bookmarkData
        )
      }
    } catch (error) {
      console.error("Lỗi trong quá trình xử lý bookmark:", error)
    }
  }
})

chrome.bookmarks.onRemoved.addListener(async (id) => {
  console.log("Process xoá bookmark id:", id)
  const userId = (await supabase.auth.getUser()).data.user.id

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("browser_bookmark_id", id)
    .eq("user_id", userId)
  if (error) {
    console.error("Xoá bookmark bị lỗi", error.message)
  }
})
