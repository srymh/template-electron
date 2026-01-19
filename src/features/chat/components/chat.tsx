import { useState } from 'react'
import { useChat } from '@tanstack/ai-react'
import ReactMarkdown from 'react-markdown'

import { fetchIpcEvents } from '@/lib/fetchIpcEvents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Chat() {
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
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

              // tool-call part
              if (part.type === 'tool-call') {
                return (
                  <details
                    key={idx}
                    open={false}
                    className="text-sm text-accent-foreground italic bg-accent p-2 rounded-md mb-2"
                  >
                    <summary>Tool Call: {part.name}</summary>
                    <pre className="not-italic">
                      {JSON.stringify(part, null, 2)}
                    </pre>
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
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 pt-0">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        ></Input>
        <Button variant="secondary" type="submit" disabled={isLoading}>
          Send
        </Button>
      </form>
    </div>
  )
}
