import * as React from 'react'

import type { ChatClientState, UIMessage } from '@tanstack/ai-client'
import { useChat } from '@tanstack/ai-react'

import { aiChatAdapter } from '@repo/ai/react'
import type { Model } from '@repo/ai/shared'
import { aiChat } from '@your-app-name/api/renderer'

import { chatTools } from '@/features/chat/tools/chat-client-tools'

import { useChatDraft } from '../hooks/use-chat-draft'

/** このチャットが扱うツールの型に結び付いた送受信状態。 */
type ChatState = ReturnType<typeof useChat<typeof chatTools>>

type ChatSessionValue = {
  isNotAvailable: boolean
  composer: ReturnType<typeof useChatDraft>['state'] & { submit: () => Promise<void> }
  // ツールのジェネリクスをアプリ全体に配管することなく変更できるように、
  // これらは意図的に広く保ちます。
  messages: ReadonlyArray<UIMessage>
  isLoading: boolean
  stop: () => void
  status: ChatClientState
  error: ChatState['error']
  interrupts: ChatState['interrupts']
  resuming: boolean
}

const ChatSessionContext = React.createContext<ChatSessionValue | null>(null)

/** 接続先のモデルと、チャット状態を利用する子要素。 */
export type ChatSessionProviderProps = {
  model?: Model
  children: React.ReactNode
}

/** チャット API とクライアントツールを接続し、送受信状態を配下へ提供する。 */
export function ChatSessionProvider(props: ChatSessionProviderProps) {
  const { model = 'gpt-oss:20b', children } = props
  const [threadId] = React.useState(() => crypto.randomUUID())
  const draft = useChatDraft()

  // 接続と利用可否を一緒に初期化し、描画中のrefの読み書きを避ける。
  const [{ connection, isNotAvailable }] = React.useState(() => {
    try {
      const {
        chat,
        on: { chunk },
      } = aiChat
      return { connection: aiChatAdapter({ chat, addListener: chunk }), isNotAvailable: false }
    } catch {
      return {
        isNotAvailable: true,
        connection: {
          async *connect() {
            // APIが利用できない環境ではチャットの応答を生成しない。
          },
        },
      }
    }
  })

  const chat = useChat({
    threadId,
    connection,
    tools: chatTools,
    forwardedProps: {
      model,
    },
    onResponse: draft.onResponse,
    onError: draft.onError,
  })

  const submit = async () => {
    // 承認後の続きの生成も停止できるよう、停止を通常送信の制約より先に扱う。
    if (chat.isLoading) {
      chat.stop()
      return
    }
    if (isNotAvailable || chat.resuming || chat.interrupts.length > 0) return
    await draft.sendDraft(chat.sendMessage)
  }

  const value: ChatSessionValue = {
    isNotAvailable,
    composer: { ...draft.state, submit },
    messages: chat.messages,
    isLoading: chat.isLoading,
    stop: chat.stop,
    status: chat.status,
    error: draft.state.error,
    interrupts: chat.interrupts,
    resuming: chat.resuming,
  }

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>
}

/**
 * 最も近いProviderのチャット入力と送受信状態を取得する。
 * @returns チャット状態と、入力・送受信を操作する関数
 * @throws Providerの外から呼び出した場合
 */
export function useChatSession() {
  const ctx = React.useContext(ChatSessionContext)
  if (!ctx) {
    throw new Error('useChatSession must be used within <ChatSessionProvider />')
  }
  return ctx
}
