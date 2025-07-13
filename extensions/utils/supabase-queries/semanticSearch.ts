import { supabase } from "~core/supabase"
import { generateEmbedding } from "~utils/embeddingingText"

export const semanticSearch = async (userId: string, text: string) => {
  try {
    const queryEmbedding = await generateEmbedding(text)

    const { data, error } = await supabase.rpc("match_bookmarks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.65, // Ngưỡng tương tự (điều chỉnh khi cần)
      match_count: 10, // Số lượng kết quả trả về
      user_id_param: userId // Truyền user_id để lọc kết quả
    })

    if (error) throw error
    return data
  } catch (err) {
    console.error(err)
    return []
  }
}
