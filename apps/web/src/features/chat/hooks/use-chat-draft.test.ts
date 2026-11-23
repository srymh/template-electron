import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

import { useChatDraft } from './use-chat-draft'

afterEach(cleanup)

describe('useChatDraft の受付と失敗通知', () => {
  it('送信処理が resolve しても、受付通知のない下書きは消さない', async () => {
    // Arrange: SDK の drop など、受付なしで完了する送信能力を使う。
    const sendMessage = vi.fn(async () => {})
    const { result } = renderHook(() => useChatDraft())
    act(() => result.current.state.setInput('送信されなかった本文'))

    // Act
    await act(async () => {
      await result.current.sendDraft(sendMessage)
    })
    const input = result.current.state.input
    const isSending = result.current.state.isSending

    // Assert
    expect(input).toBe('送信されなかった本文')
    expect(isSending).toBe(false)
  })

  it('受付後のオブジェクト形式の拒否も読みやすく表示し、本文を復元する', async () => {
    // Arrange
    const { result } = renderHook(() => useChatDraft())
    act(() => result.current.state.setInput('復元する本文'))
    const sendMessage = vi.fn(async () => {
      result.current.onResponse()
      throw { errors: [{ message: '承認の応答を確認してください' }] }
    })

    // Act
    await act(async () => {
      await result.current.sendDraft(sendMessage)
    })
    const input = result.current.state.input
    const error = result.current.state.error?.message

    // Assert
    expect(input).toBe('復元する本文')
    expect(error).toBe('承認の応答を確認してください')
  })

  it('新しい実行の受付で古いエラーを消し、その後の失敗を表示する', () => {
    // Arrange
    const { result } = renderHook(() => useChatDraft())
    act(() => result.current.onError(new Error('前の失敗')))

    // Act: 通常送信と承認後の再開のどちらも、この受付通知を通る。
    act(() => result.current.onResponse())
    const errorAtAcceptance = result.current.state.error
    act(() => result.current.onError(new Error('再開した実行の失敗')))
    const errorAfterResume = result.current.state.error?.message

    // Assert
    expect(errorAtAcceptance).toBeUndefined()
    expect(errorAfterResume).toBe('再開した実行の失敗')
  })
})
