import type { WebContents } from 'electron'
import { chat as tanstackChat } from '@tanstack/ai'
import { createOllamaChat } from '@tanstack/ai-ollama'

import { createResponseChannel } from '#/shared/lib/ipc'

import type {
  ConstrainedModelMessage,
  InputModalitiesTypes,
  ModelMessage,
  StreamChunk,
} from '@tanstack/ai'
import type {
  AddListener,
  ApiInterface,
  WithWebContents,
  WithWebContentsApi,
} from '#/shared/lib/ipc'
import {
  switchThemeDarkTool,
  switchThemeLightTool,
} from '#/main/features/chat/tools/tools'
import { clockToolDef } from '@/features/chat/api/tools/definitions'

// -----------------------------------------------------------------------------
// 型定義

export const AI_CHAT_API_KEY = 'aiChat' as const
export type AIChatApiKey = typeof AI_CHAT_API_KEY

export type AIChatApiResponse =
  | {
      type: 'chunk'
      id: string
      chunk: StreamChunk
    }
  | { type: 'done'; id: string }
  | { type: 'error'; id: string; error: string }

// -----------------------------------------------------------------------------
// インターフェイス定義

export type AiChatApi = ApiInterface<{
  chat: (request: {
    messages: ModelMessage[]
    // data の内容に id が含まれているが、外部ライブラリ依存の挙動なのでここでは利用しない
    data: unknown
    id: string
  }) => Promise<void>
  on: {
    chunk: AddListener<AIChatApiResponse>
  }
}>

// -----------------------------------------------------------------------------
// 実装

const chat: WithWebContents<AiChatApi['chat']> = async (
  request,
  webContents,
) => {
  const { messages, id } = request
  const { sendChunk, sendDone, sendError } = createSendFn(webContents, id)

  try {
    const tools = [switchThemeDarkTool, switchThemeLightTool, clockToolDef]

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
        sendChunk(chunk)
      }
      // チャットの完了を通知
      sendDone()
    })().catch((err) => {
      // try-catch では捕捉できないエラーをキャッチ
      console.error(
        `${new Date().toISOString()} Error in AiChatApi chat stream:`,
        err,
      )
      // エラーを通知
      sendError(err)
    })
  } catch (error) {
    console.error(`${new Date().toISOString()} Error in AiChatApi chat:`, error)
    // エラーを通知
    sendError(error)
  }
}

export function getAiChatApi(): WithWebContentsApi<AiChatApi> {
  return {
    chat,
    on: {
      chunk: () => () => {}, // イベントリスナーの登録は不要
    },
  }
}

function createSendFn(webContents: WebContents, id: string) {
  const channel = createResponseChannel('aiChat.on.chunk')
  const send = (response: AIChatApiResponse) => {
    try {
      webContents.send(channel, response)
    } catch (error) {
      console.error(
        `${new Date().toISOString()} Error sending AiChatApi chunk:`,
        error,
      )
    }
  }
  const sendChunk = (chunk: StreamChunk) => {
    send({ type: 'chunk', id, chunk })
  }
  const sendDone = () => {
    send({ type: 'done', id })
  }
  const sendError = (error: unknown) => {
    send({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  return {
    sendChunk,
    sendDone,
    sendError,
  }
}

type OllamaInputModalities = readonly ['text', 'image']
type OllamaModelMessage = ConstrainedModelMessage<
  InputModalitiesTypes & {
    inputModalities: OllamaInputModalities
  }
>

function isOllamaModelMessage(
  message: ModelMessage,
): message is OllamaModelMessage {
  if (typeof message.content === 'string' || message.content === null) {
    return true
  }
  if (message.content.every((x) => x.type === 'text' || x.type === 'image')) {
    return true
  }
  return false
}
