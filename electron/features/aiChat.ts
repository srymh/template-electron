import { chat, toServerSentEventsStream } from '@tanstack/ai'
import { createOllamaChat } from '@tanstack/ai-ollama'

import { createResponseChannel } from '../lib/ipc'

import type { ModelMessage } from '@tanstack/ai'
import type { AddListener, ApiInterface, WithWebContentsApi } from '../lib/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const AI_CHAT_API_KEY = 'aiChat' as const
export type AIChatApiKey = typeof AI_CHAT_API_KEY

// -----------------------------------------------------------------------------
// インターフェイス定義

export type AiChatApi = AiChatApi_0

type AiChatApi_0 = ApiInterface<{
  chat: (request: { messages: ModelMessage[]; data: unknown }) => Promise<void>
  on: {
    chunk: AddListener<{
      chunk:
        | {
            type: 'thinking'
            id: string
            model: string
            timestamp: number
            delta: string
            content: string
          }
        | {
            type: 'content'
            id: string
            model: string
            timestamp: number
            delta: string
            content: string
            role: string
          }
        | {
            type: 'done'
            id: string
            model: string
            timestamp: number
            finishReason: string
          }
    }>
  }
}>

type AiChatApi_1 = ApiInterface<{
  chat: (request: { messages: ModelMessage[]; data: unknown }) => Promise<void>
  on: {
    chunk: AddListener<{
      chunk:
        | {
            type: 'thinking'
            id: string
            model: string
            timestamp: number
            delta: string
            content: string
          }
        | {
            type: 'content'
            id: string
            model: string
            timestamp: number
            delta: string
            content: string
            role: string
          }
        | {
            type: 'done'
            id: string
            model: string
            timestamp: number
            finishReason: string
          }
    }>
  }
}>

type AiChatApi_2 = ApiInterface<{
  chat: (request: { messages: ModelMessage[]; data: unknown }) => Promise<void>
  on: {
    chunk: AddListener<{ chunk: string }>
  }
}>

// -----------------------------------------------------------------------------
// 実装

export const getAiChatApi = getAiChatApi_0

function getAiChatApi_0(): WithWebContentsApi<AiChatApi_0> {
  return {
    chat: async (request, webContents) => {
      const { messages } = request

      const channel = createResponseChannel('aiChat.on.chunk')

      try {
        // API key が必要なモデルに対応しておらず、使用不可。
        // const gpt20CloudAdapter = createOllamaChat(
        //   'gpt-oss:20b-cloud',
        //   'http://localhost:11434',
        //   'ollama-cloud-model-api-key', // API key はサポートされていない！
        // )

        const qwen3Adapter = createOllamaChat(
          'qwen3:1.7b',
          'http://localhost:11434',
        )

        const stream = chat({
          adapter: qwen3Adapter,
          // @ts-expect-error 後で直す
          messages,
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

function getAiChatApi_1(): WithWebContentsApi<AiChatApi_1> {
  return {
    chat: async (request, webContents) => {
      const { messages } = request

      const channel = createResponseChannel('aiChat.on.chunk')

      try {
        const qwen3Adapter = createOllamaChat(
          'qwen3:1.7b',
          'http://localhost:11434',
        )

        const stream = chat({
          adapter: qwen3Adapter,
          // @ts-expect-error 後で直す
          messages,
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

function getAiChatApi_2(): WithWebContentsApi<AiChatApi_2> {
  return {
    chat: async (request, webContents) => {
      const { messages } = request

      const channel = createResponseChannel('aiChat.on.chunk')

      try {
        const qwen3Adapter = createOllamaChat(
          'qwen3:1.7b',
          'http://localhost:11434',
        )

        const stream = chat({
          adapter: qwen3Adapter,
          // @ts-expect-error 後で直す
          messages,
        })

        const readableStream = toServerSentEventsStream(stream)
        const reader = readableStream.getReader()
        const decoder = new TextDecoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            console.log(`${new Date().toISOString()} AiChatApi chunk:`, chunk)
            webContents.send(channel, { chunk })
          }
        } finally {
          reader.releaseLock()
          console.log(`${new Date().toISOString()} AiChatApi done.`)
        }
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
