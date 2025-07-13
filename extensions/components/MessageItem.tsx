import React from "react"

interface MessageItemProps {
  message: {
    role: string
    content:
      | {
          id: string
          summary: string
          title: string
          url: string
          key_info: {
            main_points: string[]
          }
        }[]
      | string
  }
  onReply?: (message: string) => void
}

export default function MessageItem({ message, onReply }: MessageItemProps) {
  return (
    <div
      className={`flex ${
        message.role === "user"
          ? "justify-end"
          : message.role === "assistant"
            ? "justify-start"
            : "justify-center"
      }`}>
      <div
        className={`p-3 rounded-lg max-w-[85%] space-y-2 ${
          message.role === "user"
            ? "bg-green-100 text-left"
            : message.role === "assistant"
              ? "bg-blue-100 text-left"
              : "bg-yellow-100 text-gray-800 text-sm italic"
        }`}>
        {message.role === "user" ? (
          // Render user message as a string (assuming only one message for user)
          message.content.toString()
        ) : (
          <>
            {Array.isArray(message.content) &&
              message.content.map((msg) => (
                <div key={msg.id} className="flex flex-col">
                  <strong className="w-full pb-2">🐳 {msg.title}</strong>
                  <a
                    className="cursor-pointer hover:text-blue-500 w-full break-all"
                    href={msg.url}
                    target="_blank"
                    rel="noopener noreferrer">
                    {msg.url}
                  </a>
                  <ul className="bg-yellow-100 p-3 rounded-lg mt-2 list-disc pl-5 space-y-1">
                    {msg.key_info.main_points.map((infor) => (
                      <li key={infor}>{infor}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </>
        )}
      </div>
      {message.role === "assistant" && (
        <button className="ml-2 cursor-pointer hover:opacity-80 transition-opacity">
          <svg
            className="w-6 h-6 text-gray-400 dark:text-white"
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
              d="M14.5 8.046H11V6.119c0-.921-.9-1.446-1.524-.894l-5.108 4.49a1.2 1.2 0 0 0 0 1.739l5.108 4.49c.624.556 1.524.027 1.524-.893v-1.928h2a3.023 3.023 0 0 1 3 3.046V19a5.593 5.593 0 0 0-1.5-10.954Z"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
