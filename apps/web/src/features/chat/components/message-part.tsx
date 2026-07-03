import type { AnyClientTool, MessagePart } from '@tanstack/ai-client'
import { FileTextIcon } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@repo/ui/components/accordion'

import { isChatAttachmentTextPart } from '../hooks/use-chat-attachment'
import type { ChatAttachmentMetadata } from '../hooks/use-chat-attachment'
import { formatBytes } from '../utils/format-bytes'
import { TextContent } from './text-content'

export function MessagePart<TTools extends ReadonlyArray<AnyClientTool> = any, TData = unknown>({
  part,
  idx,
}: {
  part: MessagePart<TTools, TData>
  idx: number
}) {
  const key = `${part.type}-${idx}`

  switch (part.type) {
    case 'text':
      if (isChatAttachmentTextPart(part)) {
        return <AttachmentPart metadata={part.metadata} />
      }

      return (
        <div>
          <TextContent content={part.content} />
        </div>
      )
    case 'thinking':
      return (
        <Accordion
          type="single"
          collapsible
          className="italic bg-muted text-muted-foreground overflow-auto"
        >
          <AccordionItem value={key}>
            <AccordionTrigger>Thinking</AccordionTrigger>
            <AccordionContent className="h-fit">{part.content}</AccordionContent>
          </AccordionItem>
        </Accordion>
      )
    case 'tool-call':
      return (
        <Accordion
          type="single"
          collapsible
          className="italic bg-muted text-muted-foreground overflow-auto"
        >
          <AccordionItem value={key}>
            <AccordionTrigger>Tool Call: {part.name}</AccordionTrigger>
            <AccordionContent>
              <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )
    case 'tool-result':
      return (
        <Accordion
          type="single"
          collapsible
          className="italic bg-muted text-muted-foreground overflow-auto"
        >
          <AccordionItem value={key}>
            <AccordionTrigger>Tool Result</AccordionTrigger>
            <AccordionContent>
              <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )
    case 'image':
      return <div>Not Implemented</div>
    case 'document':
      return <div>Not Implemented</div>
    case 'audio':
      return <div>Not Implemented</div>
    case 'video':
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
