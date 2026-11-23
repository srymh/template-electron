import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import {
  ChatSessionProvider,
  useChatSession,
} from '@/features/chat/components/chat-session-provider'
import { chatTools } from '@/features/chat/tools/chat-client-tools'

const useChatMock = vi.hoisted(() => vi.fn())
const apiState = vi.hoisted(() => ({ available: true }))

vi.mock('@tanstack/ai-react', () => ({ useChat: useChatMock }))

vi.mock('@your-app-name/api/renderer', () => ({
  aiChat: {
    get chat() {
      if (!apiState.available) throw new Error('API unavailable')
      return vi.fn()
    },
    on: { chunk: vi.fn() },
  },
}))

afterEach(() => {
  cleanup()
  useChatMock.mockReset()
  apiState.available = true
})

/** Providerが公開したAPIの利用可否を画面から確認する。 */
function SessionAvailability() {
  const { isNotAvailable } = useChatSession()
  return <output aria-label="チャットAPI">{isNotAvailable ? '利用不可' : '利用可能'}</output>
}

describe('ChatSessionProvider', () => {
  it('登録済みの client ツール一覧を useChat へ接続する', () => {
    // Arrange
    useChatMock.mockReturnValue({ messages: [], isLoading: false, status: 'ready' })

    // Act
    render(<ChatSessionProvider>内容</ChatSessionProvider>)

    // Assert
    expect(useChatMock.mock.lastCall?.[0].tools).toBe(chatTools)
  })

  it('APIが利用可能なら、子要素へ利用可能な状態と安定した接続を提供する', () => {
    // Arrange
    useChatMock.mockReturnValue({ messages: [], isLoading: false, status: 'ready' })
    const { getByLabelText, rerender } = render(
      <ChatSessionProvider>
        <SessionAvailability />
      </ChatSessionProvider>,
    )
    const initialConnection = useChatMock.mock.lastCall?.[0].connection
    const initialThreadId = useChatMock.mock.lastCall?.[0].threadId

    // Act
    rerender(
      <ChatSessionProvider model="gpt-oss:120b-cloud">
        <SessionAvailability />
      </ChatSessionProvider>,
    )
    const displayedAvailability = getByLabelText('チャットAPI').textContent
    const currentConnection = useChatMock.mock.lastCall?.[0].connection

    // Assert
    expect(displayedAvailability).toBe('利用可能')
    expect(currentConnection).toBe(initialConnection)
    expect(initialThreadId).toEqual(expect.any(String))
    expect(useChatMock.mock.lastCall?.[0].threadId).toBe(initialThreadId)
    expect(useChatMock.mock.lastCall?.[0].forwardedProps).toEqual({ model: 'gpt-oss:120b-cloud' })
  })

  it('APIが利用できない場合は、初回表示から子要素へ利用不可を伝える', () => {
    // Arrange
    apiState.available = false
    useChatMock.mockReturnValue({ messages: [], isLoading: false, status: 'ready' })

    // Act
    const { getByLabelText } = render(
      <ChatSessionProvider>
        <SessionAvailability />
      </ChatSessionProvider>,
    )
    const displayedAvailability = getByLabelText('チャットAPI').textContent

    // Assert
    expect(displayedAvailability).toBe('利用不可')
  })
})
