const API_KEY = process.env.PLASMO_PUBLIC_GEMINI_API_KEY

export const summarizeAndExtractKeyInfo = async (
  text: string
): Promise<{
  summary: string
  key_info: Record<string, any>
  is_summarized?: boolean
}> => {
  const apiKey = API_KEY
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

  const prompt = `Trích xuất nội dung trang web dựa vào URL mà tôi cung cấp.
  **Hướng dẫn chi tiết:**
  3.  **Tóm tắt (Summary):** Tạo một bản tóm tắt súc tích, mạch lạc (khoảng 3-5 câu) bao gồm các điểm chính, chủ đề bao trùm và bất kỳ kết luận hoặc khuyến nghị nào từ trang.
  4.  **Từ khóa (Keywords):** Xác định Lĩnh vực nội dung bài viết, thể hiện chủ đề và các khái niệm cốt lõi. ví duk: Showbiz, Công nghệ, ReactJs, Supabase,...
  5.  **Ý chính (Main Points):** Phân tích cấu trúc và logic của bài viết để xác định 3-6 ý chính riêng biệt mà nội dung trang muốn truyền tải. Mỗi ý chính nên là một câu hoàn chỉnh và độc lập.

  Trích xuất các thông tin chính dưới dạng JSON.
  Ví dụ về cấu trúc JSON: {"keywords": ["keyword1", "keyword2"], "main_points": ["point1", "point2"]}.
  URL trang web cần phân tích: ${text}`

  const payload = {
    system_instruction: {
      parts: [
        {
          text: `Bạn là một AI có khả năng trích xuất thông tin thông minh từ các URL. Người dùng sẽ cung cấp một URL của trang web. Nhiệm vụ của bạn là phân tích nội dung trang và cung cấp.
          Nếu trang web không có nội dung hoặc là SPA, internal app, thì trả về 'is_summarized' = false`
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
          },
          is_summarized: { type: "BOOLEAN" }
        },
        required: ["summary", "key_info", "is_summarized"]
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
      return {
        summary: "Không thể tóm tắt.",
        key_info: {},
        is_summarized: false
      }
    }
  } catch (error) {
    console.error("Lỗi trong quá trình gọi Gemini API:", error)
    throw error
  }
}
