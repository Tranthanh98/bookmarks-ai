import { type User } from "@supabase/supabase-js"
import { useState } from "react"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import type { LoginForm } from "~components/PanelLogin"
import { supabase } from "~core/supabase"

const storage = new Storage({
  area: "local"
})

export default function useAuth() {
  const [error, setError] = useState("")

  const [user, setUser] = useStorage<User>({
    key: "user",
    instance: new Storage({
      area: "local"
    })
  })

  const handleLogin = async ({ email, password }: LoginForm) => {
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setError(error.message)
    }

    if (data.user) {
      setUser(data.user)
    }
  }

  const handleSignup = async ({ email, password }: LoginForm) => {
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      setError(error.message)
    }

    if (data.user) {
      setUser(data.user)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return {
    user,
    error,
    setUser,
    handleLogin,
    handleSignup,
    handleLogout
  }
}
