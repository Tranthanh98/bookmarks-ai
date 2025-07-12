import { supabase } from "~core/supabase"

// Khóa API
const API_KEY = process.env.PLASMO_PUBLIC_GEMINI_API_KEY

async function generateEmbedding(text: string): Promise<number[]> {
  const apiUrl =
    "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"

  const payload = {
    model: "models/text-embedding-004",
    content: {
      parts: [
        {
          text
        }
      ]
    }
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        `Lỗi API: ${response.status} - ${errorData.error.message}`
      )
    }

    const result = await response.json()

    console.log("embedding result:", result)

    return result?.embedding?.values
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error)
    throw error
  }
}

async function summarizeAndExtractKeyInfo(
  text: string
): Promise<{ summary: string; key_info: Record<string, any> }> {
  const apiKey = API_KEY
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

  const prompt = `Trích xuất nội dung trang web dựa vào URL mà tôi cung cấp.
  **Hướng dẫn chi tiết:**
  3.  **Tóm tắt (Summary):** Tạo một bản tóm tắt súc tích, mạch lạc (khoảng 3-5 câu) bao gồm các điểm chính, chủ đề bao trùm và bất kỳ kết luận hoặc khuyến nghị nào từ trang.
  4.  **Từ khóa (Keywords):** Xác định các từ và cụm từ xuất hiện thường xuyên hoặc có ý nghĩa quan trọng trong nội dung, thể hiện chủ đề và các khái niệm cốt lõi. Cung cấp ít nhất 7 từ khóa.
  5.  **Ý chính (Main Points):** Phân tích cấu trúc và logic của bài viết để xác định 3-6 ý chính riêng biệt mà nội dung trang muốn truyền tải. Mỗi ý chính nên là một câu hoàn chỉnh và độc lập.

  Trích xuất các thông tin chính dưới dạng JSON.
  Ví dụ về cấu trúc JSON: {"keywords": ["keyword1", "keyword2"], "main_points": ["point1", "point2"]}.
  URL trang web cần phân tích: ${text}`

  const payload = {
    system_instruction: {
      parts: [
        {
          text: `Bạn là một AI có khả năng trích xuất thông tin thông minh từ các URL. Người dùng sẽ cung cấp một URL của trang web. Nhiệm vụ của bạn là phân tích nội dung trang và cung cấp.`
        }
      ]
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          summary: { type: "STRING" },
          key_info: {
            type: "OBJECT",
            properties: {
              keywords: { type: "ARRAY", items: { type: "STRING" } },
              main_points: { type: "ARRAY", items: { type: "STRING" } }
            }
          }
        },
        required: ["summary", "key_info"]
      }
    }
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Lỗi khi gọi Gemini API:", errorData)
      throw new Error(
        `Lỗi Gemini API: ${response.status} ${response.statusText}`
      )
    }

    const result = await response.json()
    if (
      result.candidates &&
      result.candidates.length > 0 &&
      result.candidates[0].content &&
      result.candidates[0].content.parts &&
      result.candidates[0].content.parts.length > 0
    ) {
      const jsonString = result.candidates[0].content.parts[0].text
      const parsedJson = JSON.parse(jsonString)
      return parsedJson
    } else {
      console.warn("Cấu trúc phản hồi từ Gemini API không mong muốn:", result)
      return { summary: "Không thể tóm tắt.", key_info: {} }
    }
  } catch (error) {
    console.error("Lỗi trong quá trình gọi Gemini API:", error)
    throw error
  }
}

// Lắng nghe tin nhắn từ content script hoặc side panel
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "ASK") {
    const { question } = request.question
  }
  if (request.action === "ON_BOOKMARKED") {
    sendResponse({ success: true, refactoredText: request.message })
  }
  if (["refactorText", "checkGrammar", "ask"].includes(request.action)) {
    console.log("Received request:", request)

    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    })
    console.log(tab.url)
  } else if (request.action === "openSidePanel") {
    // Mở bảng điều khiển bên
    chrome.sidePanel.open({ tabId: sender.tab.id })
    sendResponse({ success: true })
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
