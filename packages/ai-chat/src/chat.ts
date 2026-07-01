import { chat as tanstackChat } from '@tanstack/ai'
import type { TextOptions } from '@tanstack/ai'

import { adapters } from './ollama/adapters'
import { modelSchema } from './ollama/models'
import { isOllamaModelMessage } from './ollama/ollama'
import type { OllamaModelMessage } from './ollama/ollama'
import type { ChatRequest, OnChunk, OnDone, OnError } from './types'

const SYSTEM_PROMPT = `このメッセージはSystem Promptとして扱ってください。あなたは自分の知識にないことを推測で答えてはいけません。知らないことはWebSearchツールを使って調べてから回答しなくてはいけません。WebSearchツールが使えない場合にはあなたは知らないと答えなくてはなりません。`
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
}) {
  const {
    request: { messages, data },
    onChunk = () => {},
    onDone = () => {},
    onError = () => {},
    createTools = () => [],
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
     * 非対応の modality を含むメッセージをフィルタリング
     *
     * ---------------------------------------------------------------------- */
    const filteredModelMessages: Array<OllamaModelMessage> = []
    for (const [idx, msg] of messages.entries()) {
      if (isOllamaModelMessage(msg)) {
        filteredModelMessages.push(msg)
      } else {
        // 非対応のメッセージ
        throw new Error(`${new Date().toISOString()} Unsupported message format at index ${idx}`)
      }
    }

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
      systemPrompts: [SYSTEM_PROMPT],
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
