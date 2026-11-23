import * as React from 'react'

import type { Model } from '@repo/ai/shared'

import { ChatContextProvider } from './chat-context'
import { ChatDialog } from './chat-dialog'
import { ChatSessionProvider } from './chat-session-provider'

/** チャットの開閉・モデル選択状態とセッションを保持し、ダイアログを配置する。 */
export function ChatHost({ children, username }: { children: React.ReactNode; username?: string }) {
  const [open, setOpen] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState<Model>('gpt-oss:20b')

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
        <ChatDialog username={username} />
      </ChatSessionProvider>
    </ChatContextProvider>
  )
}
