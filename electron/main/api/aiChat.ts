import { chat, toolDefinition } from '@tanstack/ai'
import { createOllamaChat } from '@tanstack/ai-ollama'

import { createResponseChannel } from '../lib/ipc'

import type { ModelMessage, StreamChunk } from '@tanstack/ai'
import type { AddListener, ApiInterface, WithWebContentsApi } from '../lib/ipc'
import { nativeTheme } from 'electron'

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
  const switchThemeDarkToolDef = toolDefinition({
    name: 'switch_theme_dark',
    description: "Change the application's theme to dark.",
  })

  const switchThemeLightToolDef = toolDefinition({
    name: 'switch_theme_light',
    description: "Change the application's theme to light.",
  })

  const switchThemeDarkTool = switchThemeDarkToolDef.server(async () => {
    nativeTheme.themeSource = 'dark'
    console.log('theme', 'dark')
    return {
      content: [{ type: 'text', text: `テーマを「dark」に変更しました。` }],
    }
  })

  const switchThemeLightTool = switchThemeLightToolDef.server(async () => {
    nativeTheme.themeSource = 'light'
    console.log('theme', 'light')
    return {
      content: [{ type: 'text', text: `テーマを「light」に変更しました。` }],
    }
  })

  return {
    chat: async (request, webContents) => {
      const { messages } = request

      const channel = createResponseChannel('aiChat.on.chunk')

      try {
        const filteredMessages: ModelMessage<string>[] = []
        for (const msg of messages) {
          if (typeof msg.content === 'string') {
            filteredMessages.push(msg as ModelMessage<string>)
          } else if (msg.content === null) {
            // tool call などで content が null の場合も許容する
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
          tools: [switchThemeDarkTool, switchThemeLightTool],
        })

        // 非同期イテレータを即時実行してチャンクを送信
        ;(async () => {
          for await (const chunk of stream) {
            try {
              webContents.send(channel, { chunk })
            } catch (error) {
              console.error(
                `${new Date().toISOString()} Error sending AiChatApi chunk:`,
                error,
              )
            }
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
