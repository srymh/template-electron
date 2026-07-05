import * as React from 'react'

import { clientTools } from '@tanstack/ai-client'
import type { ChatClientState, MultimodalContent, UIMessage } from '@tanstack/ai-client'
import { useChat } from '@tanstack/ai-react'

import { aiChatAdapter } from '@repo/ai-chat/react-adapter'
import type { Model } from '@repo/ai-chat/shared'
import { clockTool } from '@repo/ai-tools/client/tools'
import { mcp, aiChat } from '@your-app-name/api/renderer'

type ChatSessionValue = {
  isNotAvailable: boolean
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  // ツールのジェネリクスをアプリ全体に配管することなく変更できるように、
  // これらは意図的に広く保ちます。
  messages: Array<UIMessage>
  sendMessage: (content: string | MultimodalContent) => Promise<void>
  isLoading: boolean
  stop: () => void
  status: ChatClientState
  addToolApprovalResponse: ReturnType<typeof useChat>['addToolApprovalResponse']
}

const ChatSessionContext = React.createContext<ChatSessionValue | null>(null)

export type ChatSessionProviderProps = {
  model?: Model
  children: React.ReactNode
}

export function ChatSessionProvider(props: ChatSessionProviderProps) {
  const { model = 'gpt-oss:20b-cloud', children } = props

  const isNotAvailable = React.useRef(false)

  const connection = React.useMemo(() => {
    try {
      const {
        chat,
        on: { chunk },
      } = aiChat
      return aiChatAdapter({ chat, addListener: chunk })
    } catch {
      isNotAvailable.current = true
      return {
        async *connect() {
          // 何も生成しないジェネレーター
        },
      }
    }
  }, [])
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
      isNotAvailable: isNotAvailable.current,
      input,
      setInput,
      messages: chat.messages as Array<UIMessage>,
      sendMessage: chat.sendMessage,
      isLoading: chat.isLoading,
      stop: chat.stop,
      status: chat.status,
      addToolApprovalResponse: chat.addToolApprovalResponse,
    }
  }, [
    chat.isLoading,
    chat.messages,
    chat.sendMessage,
    chat.status,
    chat.stop,
    chat.addToolApprovalResponse,
    input,
  ])

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>
}

export function useChatSession() {
  const ctx = React.useContext(ChatSessionContext)
  if (!ctx) {
    throw new Error('useChatSession must be used within <ChatSessionProvider />')
  }
  return ctx
}
