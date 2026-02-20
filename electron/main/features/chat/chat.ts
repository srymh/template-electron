import { chat as tanstackChat } from '@tanstack/ai'
import { createOllamaChat } from '@tanstack/ai-ollama'

import type { ModelMessage, ServerTool, StreamChunk } from '@tanstack/ai'
import {
  switchThemeDarkTool,
  switchThemeLightTool,
} from '#/main/features/chat/tools/tools'
import {
  isOllamaModelMessage,
  type OllamaModelMessage,
} from '#/main/features/chat/adapters/ollama'

import { clockToolDef } from '@/features/chat/api/tools/definitions'

export type ChatRequest = {
  messages: ModelMessage[]
  data: unknown
}
export type OnChunk = (chunk: StreamChunk) => void
export type OnDone = () => void
export type OnError = (error: Error) => void

export async function chat(options: {
  request: ChatRequest
  getToolsByMcp: () => Promise<ServerTool[]>
  onChunk: OnChunk
  onDone: OnDone
  onError: OnError
}) {
  const {
    getToolsByMcp,
    request: { messages },
    onChunk,
    onDone,
    onError,
  } = options

  try {
    /** ------------------------------------------------------------------------
     *
     * ツールの準備
     *
     * ---------------------------------------------------------------------- */
    const toolsByMcp = await getToolsByMcp()

    const tools = [
      switchThemeDarkTool,
      switchThemeLightTool,
      clockToolDef,
      ...toolsByMcp,
    ]

    /** ------------------------------------------------------------------------
     *
     * 非対応の modality を含むメッセージをフィルタリング
     *
     * ---------------------------------------------------------------------- */
    const filteredModelMessages: Array<OllamaModelMessage> = []
    messages.forEach((msg) => {
      if (isOllamaModelMessage(msg)) {
        filteredModelMessages.push(msg)
      } else {
        // 非対応のメッセージ
        throw new Error(
          `${new Date().toISOString()} Skipping unsupported message format: ${JSON.stringify(msg)}`,
        )
      }
    })

    /** ------------------------------------------------------------------------
     *
     * チャットストリームを作成
     *
     * ---------------------------------------------------------------------- */
    const stream = tanstackChat({
      adapter: createOllamaChat('gpt-oss:20b-cloud', 'http://localhost:11434'),
      messages: filteredModelMessages,
      tools,
      stream: true,
    })

    /** ------------------------------------------------------------------------
     *
     * 非同期イテレータをIIFEで実行して、チャットストリームをIPCでクライアントに送信
     *
     * ---------------------------------------------------------------------- */
    ;(async () => {
      for await (const chunk of stream) {
        // クライアントにチャットの応答を送信
        onChunk(chunk)
      }
      // チャットの完了を通知
      onDone()
    })().catch((err) => {
      // try-catch では捕捉できないエラーをキャッチ
      console.error(
        `${new Date().toISOString()} Error in AiChatApi chat stream:`,
        err,
      )
      // エラーを通知
      onError(err)
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error(`${new Date().toISOString()} Error in AiChatApi chat:`, err)
    // エラーを通知
    onError(err)
  }
}
