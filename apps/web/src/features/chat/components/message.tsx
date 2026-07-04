import type { UIMessage, MessagePart } from '@tanstack/ai-client'
import { BotIcon, User2Icon } from 'lucide-react'

import { useAutoScrollToBottom } from '@/hooks/use-auto-scroll-to-bottom'

export function Messages({
  children,
  messages,
}: {
  children: (message: UIMessage) => React.ReactNode
  messages: UIMessage[]
}) {
  const { scrollContainerRef, scrollBottomRef, onScroll } = useAutoScrollToBottom([messages])

  return (
    <div
      ref={scrollContainerRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-4"
    >
      {messages.map((msg) => (
        <Message key={msg.id}>{children(msg)}</Message>
      ))}
      <div ref={scrollBottomRef} />
    </div>
  )
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-border rounded bg-background text-foreground">{children}</div>
  )
}

export function MessageHeader({ message, username }: { message: UIMessage; username?: string }) {
  const timestamp = message.createdAt ? new Date(message.createdAt) : null
  return (
    <div className="p-1 flex justify-between items-center">
      {message.role === 'assistant' ? (
        <div className="flex items-end gap-1">
          <BotIcon className="size-5 text-primary" />
          <span className="font-bold">Assistant</span>
        </div>
      ) : message.role === 'user' ? (
        <div className="flex items-end gap-1">
          <User2Icon className="size-5 text-primary" />
          <span className="font-bold">{username ?? 'User'}</span>
        </div>
      ) : (
        message.role
      )}
      <div className="text-xs text-muted-foreground">
        {timestamp ? timestamp.toLocaleString() : ''}
      </div>
    </div>
  )
}

export function MessageBody({ children }: { children: React.ReactNode }) {
  return <div className="p-1 h-auto w-full">{children}</div>
}

export function MessageParts({
  children,
  messageParts,
}: {
  children: (part: MessagePart) => React.ReactNode
  messageParts: MessagePart[]
}) {
  return (
    <div className="flex flex-col gap-1">
      {messageParts.map((part, idx) => (
        <MessagePart key={getMessagePartKey(part, idx)} part={part}>
          {(part) => children(part)}
        </MessagePart>
      ))}
    </div>
  )
}

function MessagePart({
  children,
  part,
}: {
  children: (part: MessagePart) => React.ReactNode
  part: MessagePart
}) {
  return <>{children(part)}</>
}

// @todo 安定IDを生成できるようにする
function getMessagePartKey(part: MessagePart, index: number) {
  return `${part.type}-${index}`
}
