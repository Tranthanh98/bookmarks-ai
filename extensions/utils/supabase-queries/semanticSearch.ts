import type { MatchThresholdValue } from "~constant/matchThreshold"
import { supabase } from "~core/supabase"
import { generateEmbedding } from "~utils/embeddingingText"

export const semanticSearch = async (
  userId: string,
  text: string,
  match_threshold: MatchThresholdValue = 0.65
) => {
  try {
    const queryEmbedding = await generateEmbedding(text)

    const { data, error } = await supabase.rpc("match_bookmarks_hybrid", {
      query_text: text,
      query_embedding: queryEmbedding,
      match_count: 10,
      user_id_param: userId,
      match_threshold
    })

    if (error) throw error
    return data
  } catch (err) {
    console.error(err)
    return []
  }
}
