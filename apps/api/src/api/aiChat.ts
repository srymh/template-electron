import type { ModelMessage, ServerTool, StreamChunk } from '@tanstack/ai'

import { chat } from '@repo/ai-chat'
import type { ChatResponse } from '@repo/ai-chat'
import {
  attachAiChatListener,
  clearAiChatSession,
  markAiChatSessionCompleted,
  markAiChatSessionRunning,
  prepareAiChatSessionForChat,
} from '@repo/ai-chat-session'
import type { AiChatSession } from '@repo/ai-chat-session'
import { createWebSearchTool } from '@repo/ai-ollama-tools'
import { clockToolDef } from '@repo/ai-tools/client/definitions'
import {
  createSearchProjectDetailTool,
  switchThemeDarkTool,
  switchThemeLightTool,
} from '@repo/ai-tools/server/tools'
import type { AddListener, ApiInterface, WithCallerKey, WithCallerKeyApi } from '@repo/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const AI_CHAT_API_KEY = 'aiChat' as const
export type AIChatApiKey = typeof AI_CHAT_API_KEY

export type AiChatContext = {
  getToolsByMcp: () => Promise<ServerTool[]>
  getSearchProjectDetailDbPath: () => string
  getAiChatSession: () => AiChatSession | null
  setAiChatSession: (session: AiChatSession | null) => void
  getApiKey: (provider: 'ollama') => Promise<string | undefined>
}

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
    chunk: AddListener<ChatResponse>
  }
}>

// -----------------------------------------------------------------------------
// 実装

const createChat =
  <TKey>(getContext: (key: TKey) => AiChatContext): WithCallerKey<AiChatApi['chat'], TKey> =>
  async (request, key) => {
    const {
      getToolsByMcp,
      getSearchProjectDetailDbPath,
      getAiChatSession,
      setAiChatSession,
      getApiKey,
    } = getContext(key)
    const { messages, data, id } = request

    const sessionStore = {
      getSession: getAiChatSession,
      setSession: setAiChatSession,
    }
    const session = prepareAiChatSessionForChat(sessionStore)
    markAiChatSessionRunning(session)

    let settled = false

    const sendChunk = (chunk: StreamChunk) => {
      session.queue.push({ type: 'chunk', id, chunk })
    }
    const sendDone = () => {
      if (settled) return
      settled = true
      session.queue.push({ type: 'done', id })
      markAiChatSessionCompleted(session)
      session.queue.close()
    }
    const sendError = (error: unknown) => {
      if (settled) return
      settled = true
      session.queue.push({
        type: 'error',
        id,
        error: error instanceof Error ? error.message : String(error),
      })
      markAiChatSessionCompleted(session)
      session.queue.close()
    }

    const createTools = async () => {
      const toolsByMcp = await getToolsByMcp()
      const searchProjectDetailsTool = createSearchProjectDetailTool({
        dbPath: getSearchProjectDetailDbPath(),
        docName: 'example-doc',
        model: 'nomic-embed-text-v2-moe:latest',
        queryPrefix: 'search_query:',
        topK: 6,
      })
      const webSearchTool = createWebSearchTool(() => getApiKey('ollama'))
      return [
        switchThemeDarkTool,
        switchThemeLightTool,
        clockToolDef,
        ...toolsByMcp,
        searchProjectDetailsTool,
        webSearchTool,
      ]
    }

    try {
      await chat({
        request: { messages, data },
        onChunk: sendChunk,
        onDone: sendDone,
        onError: sendError,
        createTools,
      })
    } catch (error) {
      console.error(`${new Date().toISOString()} Error in AiChatApi chat:`, error)
      sendError(error)
    }
  }

export function getAiChatApi<TKey>(
  getContext: (key: TKey) => AiChatContext,
): WithCallerKeyApi<AiChatApi, TKey> {
  return {
    chat: createChat(getContext),
    on: {
      chunk: (listener, key) => {
        const { getAiChatSession, setAiChatSession } = getContext(key)
        const sessionStore = {
          getSession: getAiChatSession,
          setSession: setAiChatSession,
        }
        const session = attachAiChatListener(sessionStore)

        ;(async () => {
          for (;;) {
            const resp = await session.queue.shift()
            if (resp == null) {
              break
            }
            listener(resp)
          }
        })().catch((error) => {
          console.error(`${new Date().toISOString()} Error in AiChatApi chunk listener:`, error)
        })

        let disposed = false
        return () => {
          if (disposed) return
          disposed = true
          clearAiChatSession(sessionStore, session)
        }
      },
    },
  }
}
