const API_KEY = process.env.PLASMO_PUBLIC_GEMINI_API_KEY

export const generateEmbedding = async (text: string): Promise<number[]> => {
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
