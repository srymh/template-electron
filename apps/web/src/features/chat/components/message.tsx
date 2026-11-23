import type { UIMessage, MessagePart } from '@tanstack/ai-client'
import { BotIcon, User2Icon } from 'lucide-react'

import { useAutoScrollToBottom } from '@/hooks/use-auto-scroll-to-bottom'

/** 読み取り専用の会話履歴を描画し、末尾へのスクロールを管理する。 */
export function Messages({
  children,
  messages,
}: {
  children: (message: UIMessage) => React.ReactNode
  messages: ReadonlyArray<UIMessage>
}) {
  const { scrollContainerRef, scrollBottomRef, onScroll } = useAutoScrollToBottom([messages])

  return (
    <div
      ref={scrollContainerRef}
      onScroll={onScroll}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
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
    <div className="border-border bg-background text-foreground rounded border">{children}</div>
  )
}

export function MessageHeader({ message, username }: { message: UIMessage; username?: string }) {
  const timestamp = message.createdAt ? new Date(message.createdAt) : null
  return (
    <div className="flex items-center justify-between p-1">
      {message.role === 'assistant' ? (
        <div className="flex items-end gap-1">
          <BotIcon className="text-primary size-5" />
          <span className="font-bold">Assistant</span>
        </div>
      ) : message.role === 'user' ? (
        <div className="flex items-end gap-1">
          <User2Icon className="text-primary size-5" />
          <span className="font-bold">{username ?? 'User'}</span>
        </div>
      ) : (
        message.role
      )}
      <div className="text-muted-foreground text-xs">
        {timestamp ? timestamp.toLocaleString() : ''}
      </div>
    </div>
  )
}

export function MessageBody({ children }: { children: React.ReactNode }) {
  return <div className="h-auto w-full p-1">{children}</div>
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
