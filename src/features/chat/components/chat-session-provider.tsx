import * as React from 'react'
import { useChat } from '@tanstack/ai-react'
import { clientTools } from '@tanstack/ai-client'

import { clockTool } from '../api/tools/tools'

import type { Model } from '#/main/features/chat/ollama/models'
import type { UIMessage } from '@tanstack/ai-client'

import { fetchIpcEvents } from '@/lib/fetchIpcEvents'
import { mcp } from '@/api'

type ChatSessionValue = {
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  // ツールのジェネリクスをアプリ全体に配管することなく変更できるように、
  // これらは意図的に広く保ちます。
  messages: Array<UIMessage>
  sendMessage: (content: string) => Promise<void>
  isLoading: boolean
  stop: () => void
  status: ReturnType<typeof useChat>['status']
}

const ChatSessionContext = React.createContext<ChatSessionValue | null>(null)

export type ChatSessionProviderProps = {
  model?: Model
  children: React.ReactNode
}

export function ChatSessionProvider(props: ChatSessionProviderProps) {
  const { model = 'gpt-oss:20b-cloud', children } = props

  const connection = React.useMemo(() => fetchIpcEvents(), [])
  const tools = React.useMemo(() => clientTools(clockTool), [])

  React.useEffect(() => {
    ;(async () => {
      const status = await mcp.getServerStatus()
      if (!status.isRunning) {
        mcp.startServer({})
      }
    })()
  }, [])

  const chat = useChat({
    connection,
    tools,
    body: {
      model,
    },
  })

  const [input, setInput] = React.useState('')

  const value = React.useMemo<ChatSessionValue>(() => {
    return {
      input,
      setInput,
      messages: chat.messages as Array<UIMessage>,
      sendMessage: chat.sendMessage as (content: string) => Promise<void>,
      isLoading: chat.isLoading,
      stop: chat.stop,
      status: chat.status,
    }
  }, [
    chat.isLoading,
    chat.messages,
    chat.sendMessage,
    chat.status,
    chat.stop,
    input,
  ])

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  )
}

export function useChatSession() {
  const ctx = React.useContext(ChatSessionContext)
  if (!ctx) {
    throw new Error(
      'useChatSession must be used within <ChatSessionProvider />',
    )
  }
  return ctx
}
