import { MixerHorizontalIcon } from "@radix-ui/react-icons"
import React, { useEffect, useRef, useState } from "react"

import MessageItem from "~components/MessageItem"

import "./style.css"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import PanelLogin from "~components/PanelLogin"
import PopoverUI from "~components/Popover"
import {
  MATCH_THRESHOLD,
  matchThresholdOptions,
  type MatchThresholdValue
} from "~constant/matchThreshold"
import { STORAGE_KEYS } from "~constant/storageKeys"
import { supabase } from "~core/supabase"
import useAuth from "~hooks/useAuth"

function IndexSidePanel() {
  const [conversation, setConversation] = useState([]) // chứa danh sách { role, content }
  const [question, setQuestion] = useState("")
  const [loadingAnswer, setLoadingAnswer] = useState(false)
  const [error, setError] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const [referTextQuestion, setReferTextQuestion] = useState<string | null>(
    null
  )

  const [matchThreshold, setMatchThreshold] = useState<MatchThresholdValue>(
    MATCH_THRESHOLD.MEDIUM
  )

  const [suggestions, setSuggestions] = useState<string[]>([])
  const [user] = useStorage({
    key: STORAGE_KEYS.User,
    instance: new Storage({
      area: "local"
    })
  })
  const { handleLogout } = useAuth()

  const textareaRef = useRef(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      // Reset height về "auto" trước khi đo
      textarea.style.height = "auto"
      // Tự động đặt lại chiều cao theo nội dung
      textarea.style.height = Math.min(textarea.scrollHeight, 3 * 24) + "px" // 3 dòng * 24px (hoặc điều chỉnh theo line-height thực tế)
    }
  }, [question])

  useEffect(() => {
    ;(async () => {
      console.log("render")
      await supabase.auth.getUser()
    })()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversation])

  const handleAskQuestion = async (e) => {
    e.preventDefault()
    if (!question.trim()) {
      setError("Vui lòng nhập câu hỏi.")
      return
    }

    try {
      setLoadingAnswer(true)

      const newUserMessage = { role: "user", content: question }
      setConversation((prev) => [...prev, newUserMessage])
      setQuestion("")

      const response = await chrome.runtime.sendMessage({
        action: "ASK",
        payload: {
          question,
          userId: user?.id,
          match_threshold: matchThreshold
        }
      })

      const getContent = () => {
        if (!response.success) return "❌ " + "Đã xảy ra lỗi khi trả lời."
        if (response?.data?.length === 0) {
          return "Không có bookmark nào liên quan"
        }
        return response.data
      }

      const newAssistantMessage = {
        role: "assistant",
        content: getContent()
      }

      setConversation((prev) => [...prev, newAssistantMessage])
      if (!error) {
        const keywords = response.data.map((i) => i.key_info?.keywords).flat()
        setSuggestions([...new Set(keywords as string[])])
      }
    } finally {
      setLoadingAnswer(false)
    }
  }

  const findAllRelatedContent = async (keyword: string) => {
    setLoadingAnswer(true)
    try {
      const { data, error } = await supabase.rpc("get_bookmarks_by_tag_name", {
        tag_name_param: keyword,
        user_id_param: user?.id
      })

      const getContent = () => {
        if (error) return "❌ " + "Đã xảy ra lỗi khi trả lời."
        if (data?.length === 0) return "Không có bookmark nào liên quan"
        return data
      }

      const newAssistantMessage = {
        role: "assistant",
        content: getContent()
      }

      setConversation((prev) => [...prev, newAssistantMessage])
    } finally {
      setLoadingAnswer(false)
    }
  }

  if (!user) {
    return <PanelLogin />
  }

  if (!user?.id) {
    return (
      <div className="flex m-auto justify-center align-middle">
        Đang tải thông tin người dùng...
      </div>
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
            <div key={data} className="inline-block">
              <button
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
        className="px-4 pt-2 bg-white shadow-inner flex items-center space-x-2 border-t border-gray-300">
        <div className="relative flex-1">
          <textarea
            placeholder="Tìm kiếm bookmark của bạn"
            className="w-full p-2.5 pl-4 border rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none overflow-auto hide-scrollbar"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loadingAnswer}
            required
            rows={1}
            ref={textareaRef}
            style={{
              maxHeight: "72px", // Giới hạn tối đa 3 dòng (3 * line-height)
              lineHeight: "24px",
              scrollbarWidth: "none", // Firefox
              msOverflowStyle: "none"
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loadingAnswer || !question.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
          {loadingAnswer ? "..." : "Hỏi"}
        </button>
      </form>
      <div className="px-4 py-2 bg-white shadow-inner flex items-left space-x-2">
        <PopoverUI
          triggerElement={
            <button className="text-gray-900 bg-white border border-gray-300 focus:ring-gray-100 hover:bg-gray-100 cursor-pointer p-1 rounded-lg">
              <MixerHorizontalIcon className="w-5 h-5" />
            </button>
          }>
          <div className="p-1 text-left text-gray-900 flex flex-col gap-2">
            <p className="font-medium">Độ chính xác</p>
            {matchThresholdOptions.map((m) => (
              <a
                href="#"
                key={m.value}
                onClick={() => setMatchThreshold(m.value)}
                className={`text-center block px-4 py-2 rounded-lg border border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition ${matchThreshold === m.value ? " border-blue-300 bg-blue-100" : ""}`}>
                {m.title}
              </a>
            ))}
          </div>
        </PopoverUI>
      </div>
    </div>
  )
}

export default IndexSidePanel
