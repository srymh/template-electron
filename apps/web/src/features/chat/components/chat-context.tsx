import * as React from 'react'

import type { Model } from '@repo/ai-chat/shared'

type ChatContextValue = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  selectedModel: Model
  setSelectedModel: React.Dispatch<React.SetStateAction<Model>>
}

const ChatContext = React.createContext<ChatContextValue | null>(null)

export function ChatContextProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: ChatContextValue
}) {
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatDialog() {
  const { open, setOpen } = useChatContext()

  return {
    open,
    setOpen,
  }
}

export function useChatModel() {
  const { selectedModel, setSelectedModel } = useChatContext()

  return {
    selectedModel,
    setSelectedModel,
  }
}

function useChatContext() {
  const ctx = React.useContext(ChatContext)
  if (!ctx) {
    throw new Error('useChatContext must be used within <ChatHost />')
  }
  return ctx
}
