const API_KEY = process.env.PLASMO_PUBLIC_GEMINI_API_KEY

export const askAndProvideCallingFunc = async (text: string) => {
  const semanticSearch = {
    name: "semantic_search_bookmarks",
    description:
      "Tìm kiếm theo ngữ nghĩa (semantic search) tất cả bookmarks liên quan tới query search",
    parameters: {
      type: "object",
      properties: {
        textSearch: {
          type: "string",
          description:
            "Đoạn văn bản được sử dụng để generate ra text embeddings sử dụng cho semantic search"
        }
      },
      required: ["textSearch"]
    }
  }

  const searchByTagName = {
    name: "search_bookmarks_by_tag_name",
    description:
      "Tìm kiếm dấu trang của người dùng bằng tên thẻ (tag name), nó sẽ chọn tất cả các dấu trang có trường từ khóa chứa tên thẻ",
    parameters: {
      type: "object",
      properties: {
        tagName: {
          type: "string",
          description: "tên thẻ (tag name)"
        }
      },
      required: ["tagName"]
    }
  }

  const functionDeclarations = [semanticSearch, searchByTagName]

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${text}`
          }
        ]
      }
    ],
    tools: {
      functionDeclarations
    }
  }
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`

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
    console.log("result test", result)
    if (
      result.candidates &&
      result.candidates.length > 0 &&
      result.candidates[0].content &&
      result.candidates[0].content.parts &&
      result.candidates[0].content.parts.length > 0
    ) {
      const functionCall = result.candidates[0].content.parts[0].functionCall

      return functionCall
    } else {
      console.warn("Cấu trúc phản hồi từ Gemini API không mong muốn:", result)
      return { summary: "Không thể tìm kiếm thông tin.", key_info: {} }
    }
  } catch (error) {
    console.error("Lỗi trong quá trình gọi Gemini API:", error)
    throw error
  }
}
