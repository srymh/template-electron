import type { MessagePart } from '@tanstack/ai-client'

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
