import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ChatContextProvider } from './chat-context'
import { ChatDialog } from './chat-dialog'

vi.mock('./chat', () => ({ Chat: () => null }))

it('AI チャットは背後を覆う背景幕なしで開く', () => {
  // Arrange
  const chatContext = {
    open: true,
    setOpen: vi.fn(),
    selectedModel: 'gpt-oss:20b' as const,
    setSelectedModel: vi.fn(),
  }

  // Act
  render(
    <ChatContextProvider value={chatContext}>
      <ChatDialog />
    </ChatContextProvider>,
  )
  const dialog = screen.getByRole('dialog', { name: 'AIチャット' })

  // Assert
  expect(dialog.getAttribute('aria-modal')).not.toBe('true')
  expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull()
})
