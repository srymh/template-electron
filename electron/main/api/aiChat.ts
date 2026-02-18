import { nativeTheme } from 'electron'
import { chat, toolDefinition } from '@tanstack/ai'
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
  WithWebContentsApi,
} from '#/shared/lib/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const AI_CHAT_API_KEY = 'aiChat' as const
export type AIChatApiKey = typeof AI_CHAT_API_KEY

// -----------------------------------------------------------------------------
// インターフェイス定義

export type AiChatApi = ApiInterface<{
  chat: (request: { messages: ModelMessage[]; data: unknown }) => Promise<void>
  on: {
    // TODO: なんらかの ID を渡さないと混線する可能性がある?
    chunk: AddListener<
      | {
          type: 'chunk'
          chunk: StreamChunk
        }
      | { type: 'done' }
    >
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
        // 非対応の modality を含むメッセージをフィルタリング
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

        const stream = chat({
          adapter: createOllamaChat(
            'gpt-oss:20b-cloud',
            'http://localhost:11434',
          ),
          messages: filteredModelMessages,
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

          webContents.send(channel, { type: 'done' })

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
