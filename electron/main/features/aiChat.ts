import { chat } from '@tanstack/ai'
import { createOllamaChat } from '@tanstack/ai-ollama'

import { createResponseChannel } from '../lib/ipc'

import type { ModelMessage, StreamChunk } from '@tanstack/ai'
import type { AddListener, ApiInterface, WithWebContentsApi } from '../lib/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const AI_CHAT_API_KEY = 'aiChat' as const
export type AIChatApiKey = typeof AI_CHAT_API_KEY

// -----------------------------------------------------------------------------
// インターフェイス定義

export type AiChatApi = ApiInterface<{
  chat: (request: { messages: ModelMessage[]; data: unknown }) => Promise<void>
  on: {
    chunk: AddListener<{
      chunk: StreamChunk
    }>
  }
}>

// -----------------------------------------------------------------------------
// 実装

export function getAiChatApi(): WithWebContentsApi<AiChatApi> {
  return {
    chat: async (request, webContents) => {
      const { messages } = request

      const channel = createResponseChannel('aiChat.on.chunk')

      try {
        const filteredMessages: ModelMessage<string>[] = []
        for (const msg of messages) {
          if (typeof msg.content === 'string') {
            filteredMessages.push(msg as ModelMessage<string>)
          } else {
            console.warn(
              `${new Date().toISOString()} AiChatApi: Skipping non-string message content:`,
              msg,
            )
          }
        }

        const stream = chat({
          adapter: createOllamaChat(
            'gpt-oss:20b-cloud',
            'http://localhost:11434',
          ),
          messages: filteredMessages,
        })

        // 非同期イテレータを即時実行してチャンクを送信
        ;(async () => {
          for await (const chunk of stream) {
            console.log(`${new Date().toISOString()} AiChatApi chunk:`, chunk)
            webContents.send(channel, { chunk })
          }

          console.log(`${new Date().toISOString()} AiChatApi done.`)
        })()
      } catch (error) {
        console.error(
          `${new Date().toISOString()} Error in AiChatApi chat:`,
          error,
        )
      }
    },
    on: {
      chunk: () => () => {}, // イベントリスナーの登録は不要
    },
  }
}
