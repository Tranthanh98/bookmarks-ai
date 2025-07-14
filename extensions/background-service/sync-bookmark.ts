import { supabase } from "~core/supabase"
import type { BookmarkType } from "~utils/bookmarkHelpers"
import { generateEmbedding } from "~utils/embeddingingText"
import { getUserId } from "~utils/getUserId"
import { summarizeAndExtractKeyInfo } from "~utils/summarizeAndExtractKeyInfo"

export const createBookmark = async (id: string, bookmark: BookmarkType) => {
  const userId = await getUserId()

  const { data: existing, error: existingError } = await supabase
    .from("bookmarks")
    .select("summary, key_info, embedding")
    .eq("url", bookmark.url)
    .limit(1)
    .single()

  if (existingError || !existing) console.log("not found an existing bookmark")

  if (bookmark.url) {
    try {
      let summary: string, key_info: any, embedding: number[]

      if (existing) {
        summary = existing.summary
        key_info = existing.key_info
        embedding = existing.embedding
      } else {
        const summarizeRes = await summarizeAndExtractKeyInfo(bookmark.url)
        console.log("Tóm tắt:", summarizeRes.summary)
        summary = summarizeRes.summary
        key_info = summarizeRes.key_info

        // 3. Tạo embedding cho tóm tắt
        embedding = await generateEmbedding(summary)

        console.log("Embedding được tạo.")
      }
      // 2. Tóm tắt và trích xuất thông tin chính bằng Gemini API
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
}
