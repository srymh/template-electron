import type { MessagePart } from '@tanstack/ai-client'

export function MessageParts({
  children,
  messageParts,
}: {
  children: (part: MessagePart, idx: number) => React.ReactNode
  messageParts: MessagePart[]
}) {
  return (
    <div className="flex flex-col gap-1">
      {messageParts.map((part, idx) => children(part, idx))}
    </div>
  )
}

export function MessagePart({
  children,
  part,
}: {
  children: (part: MessagePart) => React.ReactNode
  part: MessagePart
}) {
  return <>{children(part)}</>
}
