import * as React from 'react'

import type { Model } from '@repo/ai-chat/shared'

import { ChatContextProvider } from './chat-context'
import { ChatDialog } from './chat-dialog'
import { ChatSessionProvider } from './chat-session-provider'

export function ChatHost({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState<Model>('gpt-oss:20b-cloud')

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      selectedModel,
      setSelectedModel,
    }),
    [open, selectedModel],
  )

  return (
    <ChatContextProvider value={value}>
      <ChatSessionProvider model={selectedModel}>
        {children}
        <ChatDialog />
      </ChatSessionProvider>
    </ChatContextProvider>
  )
}
