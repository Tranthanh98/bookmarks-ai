import { type User } from "@supabase/supabase-js"
import React, { useEffect, useRef, useState } from "react"

import { Storage } from "@plasmohq/storage"

import MessageItem from "~components/MessageItem"

import "./style.css"

import { useStorage } from "@plasmohq/storage/hook"

import PanelLogin, { type LoginForm } from "~components/PanelLogin"
import { supabase } from "~core/supabase"

const storage = new Storage({
  area: "local"
})

const API_KEY = process.env.PLASMO_PUBLIC_GEMINI_API_KEY

function IndexSidePanel() {
  const [conversation, setConversation] = useState([]) // chứa danh sách { role, content }
  const [question, setQuestion] = useState("")
  const [loadingAnswer, setLoadingAnswer] = useState(false)
  const [error, setError] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const [referTextQuestion, setReferTextQuestion] = useState<string | null>(
    null
  )
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [user, setUser] = useStorage<User>({
    key: "user",
    instance: new Storage({
      area: "local"
    })
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversation])

  useEffect(() => {
    console.log("check usser", user)

    const getSession = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      console.log("session", session)
      if (session?.user) {
        setUser(session.user)
        await storage.set("accessToken", session.access_token)
      }
    }

    getSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("session", session)

      if (session?.user) {
        setUser(session.user)
        await storage.set("accessToken", session.access_token)
      } else {
        setUser(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleAskQuestion = async (e) => {
    e.preventDefault()
    if (!question.trim()) {
      setError("Vui lòng nhập câu hỏi.")
      return
    }

    const newUserMessage = { role: "user", content: question }
    setConversation((prev) => [...prev, newUserMessage])
    setQuestion("")

    semanticSearch(newUserMessage.content)
  }

  const generateEmbedding = async (): Promise<number[]> => {
    const apiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"

    console.log("question", question)

    const payload = {
      model: "models/text-embedding-004",
      content: {
        parts: [
          {
            text: question
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

  const semanticSearch = async (content: string) => {
    if (!content) return
    try {
      setLoadingAnswer(true)
      setError("")

      const queryEmbedding = await generateEmbedding()

      const { data, error } = await supabase.rpc("match_bookmarks", {
        query_embedding: queryEmbedding,
        match_threshold: 0.65, // Ngưỡng tương tự (điều chỉnh khi cần)
        match_count: 10, // Số lượng kết quả trả về
        user_id_param: user.id // Truyền user_id để lọc kết quả
      })

      console.log("data", data)

      const newAssistantMessage = {
        role: "assistant",
        content: !error ? data : "❌ " + "Đã xảy ra lỗi khi trả lời."
      }

      setConversation((prev) => [...prev, newAssistantMessage])
      if (!error) {
        const keywords = data.map((i) => i.key_info.keywords).flat()
        console.log("keywords", keywords)
        setSuggestions([...new Set(keywords as string[])])
      }
    } catch (err) {
      setError(`Lỗi khi gọi API: ${err.message}`)
      setConversation((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Lỗi: ${err.message}` }
      ])
    } finally {
      setLoadingAnswer(false)
    }
  }

  const findAllRelatedContent = async (keyword: string) => {
    const { data, error } = await supabase.rpc("get_bookmarks_by_tag_name", {
      tag_name_param: keyword,
      user_id_param: user?.id
    })

    if (!error) {
      console.log("Bookmarks theo tag:", data)
    }
  }

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

  if (!user) {
    return (
      <PanelLogin onLogin={handleLogin} onSignup={handleSignup} error={error} />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex justify-between bg-white shadow-md p-4 text-center text-blue-700 font-bold text-xl sticky top-0 z-10">
        Gemini Page Assistant
        <button
          className="bg-blue-100 hover:bg-blue-200 text-blue-500 px-3 py-1 rounded-sm shadow-sm transition cursor-pointer"
          onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.map((msg, idx) => {
          return (
            <MessageItem
              key={idx}
              message={msg}
              onReply={(reply) => {
                setReferTextQuestion(reply)
              }}
            />
          )
        })}
        {loadingAnswer && (
          <div className={`flex justify-center`}>
            <div
              className={`p-3 rounded-lg max-w-[85%] bg-yellow-100 text-gray-800 text-sm italic`}>
              AI thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />

        {error && (
          <div className="text-red-600 text-sm p-2 bg-red-100 rounded-md">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-col space-y-2">
        <div className="flex space-x-1 px-4 max-w-full overflow-x-auto pb-4">
          {suggestions.map((data) => (
            <div className="inline-block">
              <button
                key={data}
                onClick={() => findAllRelatedContent(data)}
                className="max-w-[120px] truncate whitespace-nowrap overflow-hidden text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-full shadow-sm transition disabled:opacity-50"
                disabled={loadingAnswer}
                title={data}>
                {data}
              </button>
            </div>
          ))}
        </div>

        {referTextQuestion && (
          <div className="p-4 bg-gray-50 border-t border-gray-300 ">
            <span className="flex justify-between items-center text-gray-800 dark:text-white">
              Đặt câu hỏi cho đoạn văn bản này:
              <svg
                onClick={() => setReferTextQuestion(null)}
                className="w-6 h-6 text-gray-800 dark:text-white cursor-pointer"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="m15 9-6 6m0-6 6 6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </span>
            <div className="text-gray-600 text-sm italic line-clamp-3 mt-2">
              {referTextQuestion}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleAskQuestion}
        className="p-4 bg-white shadow-inner flex items-center space-x-2 border-t border-gray-300">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm bookmark của bạn"
            className="w-full p-2.5 pl-10 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loadingAnswer}
            required
          />
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            🛠
          </div>
        </div>
        <button
          type="submit"
          disabled={loadingAnswer || !question.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
          {loadingAnswer ? "..." : "Hỏi"}
        </button>
      </form>
    </div>
  )
}

export default IndexSidePanel
