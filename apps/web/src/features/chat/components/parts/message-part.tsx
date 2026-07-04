import type { MessagePart } from '@tanstack/ai-client'

import { NotImplementedPartContent } from './not-implemented-part-content'
import { TextContent } from './text-content'
import { ThinkingContent } from './thinking-content'
import { ToolCallContent } from './tool-call-content'
import { ToolResultContent } from './tool-result-content'

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

export function MessagePart({ part }: { part: MessagePart }) {
  switch (part.type) {
    case 'text':
      return <TextContent part={part} />

    case 'thinking':
      return <ThinkingContent part={part} />

    case 'tool-call':
      return <ToolCallContent part={part} />

    case 'tool-result':
      return <ToolResultContent part={part} />

    case 'image':
      return <NotImplementedPartContent part={part} />

    case 'document':
      return <NotImplementedPartContent part={part} />

    case 'audio':
      return <NotImplementedPartContent part={part} />

    case 'video':
      return <NotImplementedPartContent part={part} />

    case 'structured-output':
      return <NotImplementedPartContent part={part} />

    default:
      return <NotImplementedPartContent part={part} />
  }
}
