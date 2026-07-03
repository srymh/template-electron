import type { ModelMessage, StreamChunk, UIMessage } from '@tanstack/ai'

export type ChatRequest = {
  messages: ModelMessage[] | UIMessage[]
  data: unknown
}
export type ChatResponse =
  | {
      type: 'chunk'
      id: string
      chunk: StreamChunk
    }
  | { type: 'done'; id: string }
  | { type: 'error'; id: string; error: string }
export type OnChunk = (chunk: StreamChunk) => void
export type OnDone = () => void
export type OnError = (error: Error) => void
