import { chat as tanstackChat } from '@tanstack/ai'
import type { TextOptions } from '@tanstack/ai'

import { adapters } from './ollama/adapters'
import { modelSchema } from './ollama/models'
import type { ChatRequest, OnChunk, OnDone, OnError } from './types'

const DEFAULT_MODEL = 'gpt-oss:20b-cloud'

function getRequestedModel(data: unknown) {
  if (data != null && typeof data === 'object' && 'model' in data) {
    return (data as { model?: unknown }).model
  }
  return DEFAULT_MODEL
}

export async function chat(options: {
  request: ChatRequest
  onChunk?: OnChunk
  onDone?: OnDone
  onError?: OnError
  createTools?: () => TextOptions['tools'] | Promise<TextOptions['tools']>
  systemPrompts?: string[]
}) {
  const {
    request: { messages, data },
    onChunk = () => {},
    onDone = () => {},
    onError = () => {},
    createTools = () => [],
    systemPrompts = [],
  } = options

  try {
    console.log(`${new Date().toISOString()} Starting chat with ${messages.length} messages`)

    const model = modelSchema.parse(getRequestedModel(data))
    console.log(`${new Date().toISOString()} Using model:`, model)

    /** ------------------------------------------------------------------------
     *
     * ツールの準備
     *
     * ---------------------------------------------------------------------- */
    const tools = await createTools()

    /** ------------------------------------------------------------------------
     *
     * チャットストリームを作成
     *
     * ---------------------------------------------------------------------- */
    const stream = tanstackChat({
      adapter: adapters[model](),
      messages,
      tools,
      stream: true,
      systemPrompts: [...systemPrompts],
    })

    /** ------------------------------------------------------------------------
     *
     * チャットストリームを最後まで待機しながら、IPC でクライアントに送信
     *
     * ---------------------------------------------------------------------- */
    for await (const chunk of stream) {
      // クライアントにチャットの応答を送信
      onChunk(chunk)
    }

    // チャットの完了を通知
    onDone()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error(`${new Date().toISOString()} Error in AiChatApi chat:`, err)
    // エラーを通知
    onError(err)
  }
}
