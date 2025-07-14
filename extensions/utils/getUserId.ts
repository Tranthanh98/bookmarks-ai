import type { User } from "@supabase/supabase-js"

import { Storage } from "@plasmohq/storage"

const storage = new Storage({
  area: "local"
})

export const getUserId = async () => {
  const user = await storage.getItem<User>("user")
  return user?.id ?? null
}
