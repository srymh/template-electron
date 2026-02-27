import type { WebContents } from 'electron'

import type { ModelMessage, ServerTool, StreamChunk } from '@tanstack/ai'
import type {
  AddListener,
  ApiInterface,
  WithWebContents,
  WithWebContentsApi,
} from '#/shared/lib/ipc'
import { createResponseChannel } from '#/shared/lib/ipc'

import { chat } from '#/main/features/chat/chat'

// -----------------------------------------------------------------------------
// 型定義

export const AI_CHAT_API_KEY = 'aiChat' as const
export type AIChatApiKey = typeof AI_CHAT_API_KEY

export type AiChatContext = {
  getToolsByMcp: () => Promise<ServerTool[]>
}

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

const createChat =
  (
    getContext: (wc: WebContents) => AiChatContext,
  ): WithWebContents<AiChatApi['chat']> =>
  async (request, webContents) => {
    const { getToolsByMcp } = getContext(webContents)
    const { messages, data, id } = request
    const { sendChunk, sendDone, sendError } = createSendFn(webContents, id)

    await chat({
      request: { messages, data },
      onChunk: sendChunk,
      onDone: sendDone,
      onError: sendError,
      getToolsByMcp,
    })
  }

export function getAiChatApi(
  getContext: (wc: WebContents) => AiChatContext,
): WithWebContentsApi<AiChatApi> {
  return {
    chat: createChat(getContext),
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
