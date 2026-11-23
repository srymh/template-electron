import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chat, chatParamsFromRequestBody, EventType } from '@tanstack/ai'
import type { StreamChunk } from '@tanstack/ai'
import { fakeText } from '@tanstack/ai/testing'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import type { ChatRequest, ChatResponse } from '@repo/ai/chat'
import { addKnowledgeToolDef } from '@repo/ai/ollama/tools/definitions'

import { Chat } from './chat'
import { useChatModel } from './chat-context'
import { ChatHost } from './chat-host'
import { ChatSessionProvider, useChatSession } from './chat-session-provider'

const transport = vi.hoisted(() => ({
  chat: vi.fn<(request: ChatRequest & { id: string }) => Promise<void>>(),
  listeners: new Set<(response: ChatResponse) => void>(),
}))
const loadAttachment = vi.hoisted(() => vi.fn())

vi.mock('@your-app-name/api/renderer', () => ({
  aiChat: {
    chat: transport.chat,
    on: {
      chunk: (listener: (response: ChatResponse) => void) => {
        transport.listeners.add(listener)
        return () => transport.listeners.delete(listener)
      },
    },
  },
}))
vi.mock('../utils/load-chat-attachment-from-file-system', () => ({
  loadChatAttachmentFromFileSystem: loadAttachment,
}))
vi.mock('./select-model', () => ({ SelectModel: () => null }))
vi.mock('@/hooks/use-auto-scroll-to-bottom', () => ({
  useAutoScrollToBottom: () => ({
    scrollContainerRef: { current: null },
    scrollBottomRef: { current: null },
    onScroll: vi.fn(),
  }),
}))

beforeEach(() => {
  transport.chat.mockResolvedValue(undefined)
  loadAttachment.mockResolvedValue({
    status: 'selected',
    attachment: { name: 'draft.txt', size: 4, content: '添付本文' },
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('テスト中の外部通信は禁止'))),
  )
})

afterEach(() => {
  cleanup()
  transport.chat.mockReset()
  transport.listeners.clear()
  loadAttachment.mockReset()
  vi.unstubAllGlobals()
})

/** ダイアログの開閉を再現し、Provider は維持したまま画面を着脱する。 */
function ChatView({ visible = true }: { visible?: boolean }) {
  return (
    <ChatSessionProvider>
      <SessionControls />
      {visible && <Chat selectedModel="gpt-oss:20b" setSelectedModel={() => {}} />}
    </ChatSessionProvider>
  )
}

/** 公開された添付操作と送信状態をテストから観測する。 */
function SessionControls() {
  const { composer, isLoading, resuming } = useChatSession()
  return (
    <>
      <button onClick={composer.selectAttachment}>テスト添付</button>
      <output aria-label="送信状態">
        {composer.isSending ? 'sending' : 'idle'}:{isLoading ? 'loading' : 'ready'}:
        {resuming ? 'resuming' : 'normal'}
      </output>
    </>
  )
}

/** 選択されたモデルを Host の公開コンテキストから表示する。 */
function SelectedModel() {
  return <output aria-label="モデル">{useChatModel().selectedModel}</output>
}

/**
 * 指定要求の IPC ストリームへイベントを配送する。
 * @param request - 配送先の要求
 * @param chunk - SDK が解釈する標準イベント
 * @returns 値を返さない
 */
function emit(request: ChatRequest & { id: string }, chunk: StreamChunk) {
  for (const listener of transport.listeners) listener({ type: 'chunk', id: request.id, chunk })
}

/**
 * 標準の完了イベントと IPC の配送終了を通知する。
 * @param request - 終了する要求
 * @returns 値を返さない
 */
function finish(request: ChatRequest & { id: string }) {
  emit(request, {
    type: EventType.RUN_FINISHED,
    threadId: request.threadId,
    runId: request.runId,
    timestamp: 2,
  })
  for (const listener of transport.listeners) listener({ type: 'done', id: request.id })
}

/**
 * 入力済みの下書きを添付付きで送信し、IPC へ届くまで待つ。
 * @param container - チャットを描画した領域
 * @returns 最初の送信要求
 */
async function sendAttachedDraft(container: HTMLElement) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '送信する本文' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'テスト添付' }))
  })
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(transport.chat).toHaveBeenCalledTimes(1))
  return transport.chat.mock.calls[0]![0]
}

describe('実 SDK と IPC adapter による下書きの寿命', () => {
  it('生成完了を待たず受付時に本文・添付を消し、生成中の表示へ切り替える', async () => {
    // Arrange
    const { container } = render(<ChatView />)

    // Act
    const request = await sendAttachedDraft(container)
    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    const textDuringStream = textarea.value
    const placeholderDuringStream = textarea.placeholder
    const previewDuringStream = container.querySelector('form')!.textContent
    const stateDuringStream = screen.getByLabelText('送信状態').textContent
    await act(async () => {
      finish(request)
    })
    await waitFor(() =>
      expect(screen.getByLabelText('送信状態').textContent).toBe('idle:ready:normal'),
    )

    // Assert
    expect(textDuringStream).toBe('')
    expect(placeholderDuringStream).toContain('応答を待っています')
    expect(previewDuringStream).not.toContain('draft.txt')
    expect(stateDuringStream).toBe('sending:loading:normal')
    expect(request.forwardedProps).toEqual({ model: 'gpt-oss:20b' })
  })

  it.each(['RUN_ERROR', 'IPC'] as const)(
    '%s の失敗が Promise の resolve で終わっても本文・添付を復元し、詳細を表示する',
    async (failure) => {
      // Arrange
      const { container } = render(<ChatView />)
      const request = await sendAttachedDraft(container)

      // Act
      await act(async () => {
        if (failure === 'RUN_ERROR') {
          emit(request, {
            type: EventType.RUN_ERROR,
            message: 'Ollama に接続できません',
            timestamp: 2,
          })
          finish(request)
        } else {
          for (const listener of transport.listeners) {
            listener({ type: 'error', id: request.id, error: 'Ollama に接続できません' })
          }
        }
      })
      await waitFor(() =>
        expect(screen.getByLabelText('送信状態').textContent).toBe('idle:ready:normal'),
      )
      const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
      const formText = container.querySelector('form')!.textContent
      const errorText = screen.getByRole('alert').textContent

      // Assert
      expect(textarea.value).toBe('送信する本文')
      expect(formText).toContain('draft.txt')
      expect(errorText).toBe('Ollama に接続できません')
    },
  )

  it('ダイアログを開き直しても、古い要求の完了が新しい下書きを消さない', async () => {
    // Arrange
    const { container, rerender } = render(<ChatView />)
    const request = await sendAttachedDraft(container)
    rerender(<ChatView visible={false} />)
    rerender(<ChatView />)

    // Act: 完了直前に編集された下書きも、古い完了処理の対象にしない。
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '新しい下書き' } })
    await act(async () => {
      finish(request)
    })
    await waitFor(() =>
      expect(screen.getByLabelText('送信状態').textContent).toBe('idle:ready:normal'),
    )
    const currentDraft = screen.getByRole<HTMLTextAreaElement>('textbox').value

    // Assert
    expect(currentDraft).toBe('新しい下書き')
  })

  it('古い要求の失敗も、開き直した後に編集した下書きを上書きしない', async () => {
    // Arrange
    const { container, rerender } = render(<ChatView />)
    const request = await sendAttachedDraft(container)
    rerender(<ChatView visible={false} />)
    rerender(<ChatView />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '新しい下書き' } })

    // Act
    await act(async () => {
      emit(request, { type: EventType.RUN_ERROR, message: '古い要求の失敗', timestamp: 2 })
      finish(request)
    })
    await waitFor(() =>
      expect(screen.getByLabelText('送信状態').textContent).toBe('idle:ready:normal'),
    )
    const currentDraft = screen.getByRole<HTMLTextAreaElement>('textbox').value

    // Assert
    expect(currentDraft).toBe('新しい下書き')
    expect(container.querySelector('form')!.textContent).not.toContain('draft.txt')
  })

  it.each(['button', 'form', 'keyboard'] as const)(
    '承認待ちでは通常送信せず、承認後の再開中は %s で停止できる',
    async (operation) => {
      // Arrange: 初回は本物のエンジンから承認 Interrupt を生成する。
      const adapter = fakeText()
      adapter.setResponses([
        { toolCalls: [{ id: 'save-1', name: 'addKnowledge', input: { content: '本文' } }] },
      ])
      transport.chat.mockImplementationOnce(async (request) => {
        const params = await chatParamsFromRequestBody(request)
        for await (const chunk of chat({
          adapter,
          messages: params.messages,
          threadId: params.threadId,
          runId: params.runId,
          tools: [
            addKnowledgeToolDef.server(async () => ({ success: true, message: '保存しました' })),
          ],
        }))
          emit(request, chunk)
        for (const listener of transport.listeners) listener({ type: 'done', id: request.id })
      })
      const { container } = render(<ChatView />)
      await sendAttachedDraft(container)
      await waitFor(() => expect(screen.getByRole('button', { name: '承認' })).toBeTruthy())

      // Act: disabled のフォームへの直接送信でも承認待ちの下書きを守る。
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '承認待ちの下書き' } })
      fireEvent.submit(container.querySelector('form')!)
      fireEvent.keyDown(container.querySelector('form')!, { key: 'Enter', ctrlKey: true })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '承認' }))
      })
      await waitFor(() => expect(transport.chat).toHaveBeenCalledTimes(2))
      const stateWhileResuming = screen.getByLabelText('送信状態').textContent
      const stopButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
      const stopDisabled = stopButton.disabled
      if (operation === 'button') fireEvent.click(stopButton)
      else if (operation === 'form') fireEvent.submit(container.querySelector('form')!)
      else fireEvent.keyDown(container.querySelector('form')!, { key: 'Enter', ctrlKey: true })
      await waitFor(() =>
        expect(screen.getByLabelText('送信状態').textContent).toContain(':ready:'),
      )

      // Assert
      expect(stateWhileResuming).toContain(':loading:resuming')
      expect(stopDisabled).toBe(false)
      expect(transport.chat).toHaveBeenCalledTimes(2)
      expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe('承認待ちの下書き')
      expect(screen.queryByRole('alert')).toBeNull()
    },
  )

  it('Host の初期モデルにローカル gpt-oss:20b を選ぶ', () => {
    // Arrange / Act
    render(
      <ChatHost>
        <SelectedModel />
      </ChatHost>,
    )
    const model = screen.getByLabelText('モデル').textContent

    // Assert
    expect(model).toBe('gpt-oss:20b')
  })
})
