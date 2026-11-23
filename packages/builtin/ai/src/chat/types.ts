import type { RunAgentInput, StreamChunk } from '@tanstack/ai/client'

/** TanStack AI の標準 AG-UI 要求。会話・実行 ID と再開情報を含む。 */
export type ChatRequest = RunAgentInput
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
