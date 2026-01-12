import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useChat } from '@tanstack/ai-react'
import ReactMarkdown from 'react-markdown'

import { fetchIpcEvents } from '@/lib/fetchIpcEvents'

export const Route = createFileRoute('/demo/chat-t')({
  component: RouteComponent,
})

function RouteComponent() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, isLoading } = useChat({
    connection: fetchIpcEvents(),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      sendMessage(input)
      setInput('')
    }
  }

  return (
    <div>
      <div className="p-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="p-2 mb-2 border rounded-lg bg-background"
          >
            <div className="font-bold mb-1">{msg.role}</div>
            {msg.parts.map((part, idx) => {
              // thinking part
              if (part.type === 'thinking') {
                return (
                  <details
                    key={idx}
                    open={false}
                    className="text-sm text-accent-foreground italic bg-accent p-2 rounded-md mb-2"
                  >
                    <summary>Thinking...</summary>
                    {part.content}
                  </details>
                )
              }

              // text part
              if (part.type === 'text') {
                return (
                  <div key={idx} className="">
                    <ReactMarkdown>{part.content}</ReactMarkdown>
                  </div>
                )
              }

              // ...other part types
              return null
            })}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          className="border px-2 py-1 mr-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        ></input>
        <button
          className="border px-2 py-1 bg-blue-500 text-white disabled:bg-gray-400"
          type="submit"
          disabled={isLoading}
        >
          Send
        </button>
      </form>
    </div>
  )
}
