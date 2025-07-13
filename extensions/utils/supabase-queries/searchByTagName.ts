import { supabase } from "~core/supabase"

export const searchByTagName = async (userId: string, tagName: string) => {
  const { data, error } = await supabase.rpc("get_bookmarks_by_tag_name", {
    tag_name_param: tagName,
    user_id_param: userId
  })

  if (error || !data) {
    console.log("Lỗi:", error)
    return []
  }

  return data
}
