import type { MessagePart } from '@tanstack/ai-client'

export function NotImplementedPartContent({ part }: { part: MessagePart }) {
  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-muted/40 p-2 text-sm text-muted-foreground">
      <div>Not Implemented: Part Type - {part.type}</div>
      <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre>
    </div>
  )
}
