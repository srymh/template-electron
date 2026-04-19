import { chat as tanstackChat } from '@tanstack/ai'
import type { ModelMessage, StreamChunk, TextOptions } from '@tanstack/ai'

import { adapters } from './ollama/adapters'
import { modelSchema } from './ollama/models'
import { isOllamaModelMessage, type OllamaModelMessage } from './ollama/ollama'

export type ChatRequest = {
  messages: ModelMessage[]
  data: unknown
}
export type OnChunk = (chunk: StreamChunk) => void
export type OnDone = () => void
export type OnError = (error: Error) => void

export async function chat(options: {
  request: ChatRequest
  onChunk?: OnChunk
  onDone?: OnDone
  onError?: OnError
  createTools?: () => TextOptions['tools'] | Promise<TextOptions['tools']>
}) {
  const {
    request: { messages, data },
    onChunk = () => {},
    onDone = () => {},
    onError = () => {},
    createTools = () => [],
  } = options

  try {
    console.log(`${new Date().toISOString()} Starting chat with messages:`, messages)
    console.log(`${new Date().toISOString()} Chat request data:`, data)

    const model = modelSchema.parse((data as any)?.model || 'gpt-oss:20b-cloud')
    console.log(`${new Date().toISOString()} Using model:`, model)

    /** ------------------------------------------------------------------------
     *
     * ツールの準備
     *
     * ---------------------------------------------------------------------- */
    const tools = await createTools()

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
      adapter: adapters[model](),
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
      console.error(`${new Date().toISOString()} Error in AiChatApi chat stream:`, err)
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
