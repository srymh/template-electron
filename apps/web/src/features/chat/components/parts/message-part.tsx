import type { UIMessage } from '@tanstack/ai'
import type { AnyClientTool, MessagePart } from '@tanstack/ai-client'
import { FileTextIcon } from 'lucide-react'

import { isChatAttachmentTextPart } from '../../hooks/use-chat-attachment'
import type { ChatAttachmentMetadata } from '../../hooks/use-chat-attachment'
import { formatBytes } from '../../utils/format-bytes'
import { ExpandableSection } from '../utils/expandable-section'
import { ParameterDisplay } from '../utils/parameter-display'
import { TextContent } from './text-content'
import { ToolCallContent } from './tool-call-content'

export function MessageParts({
  children,
  messageParts,
}: {
  children: (part: UIMessage['parts'][number], idx: number) => React.ReactNode
  messageParts: UIMessage['parts']
}) {
  return (
    <div className="flex flex-col gap-1">
      {messageParts.map((part, idx) => children(part, idx))}
    </div>
  )
}

export function MessagePart<TTools extends ReadonlyArray<AnyClientTool> = any, TData = unknown>({
  part,
}: {
  part: MessagePart<TTools, TData>
}) {
  switch (part.type) {
    case 'text':
      if (isChatAttachmentTextPart(part)) {
        return <AttachmentPart metadata={part.metadata} />
      }

      return (
        <div className="w-full overflow-x-auto">
          <TextContent content={part.content} />
        </div>
      )

    case 'thinking':
      return <ExpandableSection title="Thinking">{part.content}</ExpandableSection>

    case 'tool-call':
      return <ToolCallContent part={part} />

    case 'tool-result':
      return (
        <ExpandableSection title={`Tool Result${part.error ? ' (Error)' : ''}`}>
          {/* <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre> */}
          <ParameterDisplay
            rows={[
              {
                label: 'content',
                value:
                  typeof part.content === 'string'
                    ? part.content
                    : JSON.stringify(part.content, null, 2),
              },
              { label: 'state', value: JSON.stringify(part.state, null, 2) },
              ...(part.error
                ? [{ label: 'error', value: JSON.stringify(part.error, null, 2) }]
                : []),
            ]}
          />
        </ExpandableSection>
      )
    case 'image':
      return <div>Not Implemented</div>
    case 'document':
      return <div>Not Implemented</div>
    case 'audio':
      return <div>Not Implemented</div>
    case 'video':
      return <div>Not Implemented</div>
    case 'structured-output':
      return <div>Not Implemented</div>
    default:
      return <div>Unknown part type: {(part as any).type}</div>
  }
}

function AttachmentPart({ metadata }: { metadata: ChatAttachmentMetadata }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
      <FileTextIcon className="size-3.5 shrink-0" />
      <span className="truncate">{metadata.name}</span>
      <span className="shrink-0">{formatBytes(metadata.size)}</span>
    </div>
  )
}
