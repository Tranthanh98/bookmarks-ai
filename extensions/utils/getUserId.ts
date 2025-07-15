import type { User } from "@supabase/supabase-js"

import { Storage } from "@plasmohq/storage"

import { STORAGE_KEYS } from "~constant/storageKeys"

const storage = new Storage({
  area: "local"
})

export const getUserId = async () => {
  const user = await storage.getItem<User>(STORAGE_KEYS.User)
  return user?.id ?? null
}
