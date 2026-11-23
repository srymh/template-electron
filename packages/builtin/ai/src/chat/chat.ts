import { chat as tanstackChat, chatParamsFromRequestBody, mergeAgentTools } from '@tanstack/ai'
import type { TextOptions } from '@tanstack/ai'

import { adapters } from './ollama/adapters'
import { modelSchema } from './ollama/models'
import type { ChatRequest, OnChunk, OnDone, OnError } from './types'

const DEFAULT_MODEL = 'gpt-oss:20b'

function getRequestedModel(data: unknown) {
  if (data != null && typeof data === 'object' && 'model' in data) {
    return (data as { model?: unknown }).model
  }
  return DEFAULT_MODEL
}

/**
 * AG-UI 要求を検証し、Ollama の応答を順に通知する。
 * @param options - 要求、ツール構成、応答・終了・エラーの通知先
 * @returns ストリームの完了、または onError による失敗通知後に解決する
 */
export async function chat(options: {
  request: ChatRequest
  onChunk?: OnChunk
  onDone?: OnDone
  onError?: OnError
  createTools?: () => TextOptions['tools'] | Promise<TextOptions['tools']>
  systemPrompts?: string[]
}) {
  const {
    request,
    onChunk = () => {},
    onDone = () => {},
    onError = () => {},
    createTools = () => [],
    systemPrompts = [],
  } = options

  try {
    const {
      messages,
      forwardedProps,
      threadId,
      runId,
      parentRunId,
      resume,
      tools: clientTools,
    } = await chatParamsFromRequestBody(request)
    console.log(`${new Date().toISOString()} Starting chat with ${messages.length} messages`)

    const model = modelSchema.parse(getRequestedModel(forwardedProps))
    console.log(`${new Date().toISOString()} Using model:`, model)

    /** ------------------------------------------------------------------------
     *
     * ツールの準備
     *
     * ---------------------------------------------------------------------- */
    const serverTools = await createTools()
    // 標準の宣言を取り込み、同名の場合は server 側の構成を優先する。
    const tools = mergeAgentTools(serverTools ?? [], clientTools)

    /** ------------------------------------------------------------------------
     *
     * チャットストリームを作成
     *
     * ---------------------------------------------------------------------- */
    const stream = tanstackChat({
      adapter: adapters[model](),
      messages,
      threadId,
      runId,
      parentRunId,
      resume,
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
