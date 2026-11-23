import type { StreamChunk, TextOptions } from '@tanstack/ai'

import { chat } from '@repo/ai/chat'
import type { ChatRequest, ChatResponse } from '@repo/ai/chat'
import {
  attachAiChatListener,
  clearAiChatSession,
  markAiChatSessionCompleted,
  markAiChatSessionRunning,
  prepareAiChatSessionForChat,
} from '@repo/ai/chat/session'
import type { AiChatSession } from '@repo/ai/chat/session'
import type { AddListener, ApiInterface, WithCallerKey, WithCallerKeyApi } from '@repo/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const AI_CHAT_API_KEY = 'aiChat' as const
export type AIChatApiKey = typeof AI_CHAT_API_KEY

/** window ごとのセッションと、要求ごとに評価するツール構成の注入契約。 */
export type AiChatContext = {
  getAiChatSession: () => AiChatSession | null
  setAiChatSession: (session: AiChatSession | null) => void
  /** 要求ごとに評価し、その要求でモデルへ渡すツール一覧を返す。 */
  createTools: () => TextOptions['tools'] | Promise<TextOptions['tools']>
  /** 要求開始時に評価し、その要求で使うシステムプロンプトを返す。 */
  getSystemPrompts: () => string[]
  /** 添付文書の本文を取り込む。 */
  ingestDocument: (text: string) => Promise<void>
}

// -----------------------------------------------------------------------------
// インターフェイス定義

export type AiChatApi = ApiInterface<{
  /** 標準 AG-UI 要求を実行し、id で対応付けた応答を通知する。 */
  chat: (request: ChatRequest & { id: string }) => Promise<void>
  ingestDocument: (text: string) => Promise<void>
  on: {
    chunk: AddListener<ChatResponse>
  }
}>

// -----------------------------------------------------------------------------
// 実装

const createChat =
  <TKey>(getContext: (key: TKey) => AiChatContext): WithCallerKey<AiChatApi['chat'], TKey> =>
  (key) =>
  async (request) => {
    const { getAiChatSession, setAiChatSession, createTools, getSystemPrompts } = getContext(key)
    const { id, ...chatRequest } = request

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

    try {
      await chat({
        request: chatRequest,
        onChunk: sendChunk,
        onDone: sendDone,
        onError: sendError,
        createTools,
        systemPrompts: getSystemPrompts(),
      })
    } catch (error) {
      console.error(`${new Date().toISOString()} Error in AiChatApi chat:`, error)
      sendError(error)
    }
  }

/**
 * 呼び出し元キーを受け取って各操作を返すAI チャット API を構成する。
 * @param getContext - 呼び出し元キーに対応する context を取得する関数
 * @returns 各操作をキーに対応する context へ接続する API
 */
export function getAiChatApi<TKey>(
  getContext: (key: TKey) => AiChatContext,
): WithCallerKeyApi<AiChatApi, TKey> {
  return {
    chat: createChat(getContext),
    ingestDocument: (key) => async (text: string) => {
      await getContext(key).ingestDocument(text)
    },
    on: {
      chunk: (key) => (listener) => {
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
