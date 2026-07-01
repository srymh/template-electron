import { describe, expect, it, vi } from 'vitest'
import type { MessagePart } from '@tanstack/ai-client'
import { act, renderHook } from '@testing-library/react'

import {
  createChatAttachmentMessagePart,
  getAttachmentErrorMessage,
  isAllowedChatAttachment,
  isChatAttachmentTextPart,
  useChatAttachment,
} from '@/features/chat/hooks/use-chat-attachment'
import type { ChatAttachment, LoadChatAttachment } from '@/features/chat/hooks/use-chat-attachment'

describe('useChatAttachment', () => {
  // -----------------------------------------------------------------------------------------------
  // 添付ファイルの選択が成功した場合、attachmentFile に選択された添付ファイルが格納されることを確認する
  // -----------------------------------------------------------------------------------------------
  it('stores a selected attachment', async () => {
    const attachment = createAttachment()
    const loadAttachment = vi
      .fn<LoadChatAttachment>()
      .mockResolvedValueOnce({ status: 'selected', attachment })

    const { result } = renderHook(() => useChatAttachment({ loadAttachment }))

    await act(async () => {
      await result.current.selectAttachment()
    })

    expect(loadAttachment).toHaveBeenCalledTimes(1)
    expect(result.current.attachmentFile).toEqual(attachment)
    expect(result.current.attachmentError).toBeNull()
  })

  // -----------------------------------------------------------------------------------------------
  // 選択されたファイルが無効な場合、現在の添付ファイルがクリアされることを確認する
  // -----------------------------------------------------------------------------------------------
  it('clears the current attachment when the selected file is invalid', async () => {
    const attachment = createAttachment()
    const loadAttachment = vi
      .fn<LoadChatAttachment>()
      .mockResolvedValueOnce({ status: 'selected', attachment })
      .mockResolvedValueOnce({ status: 'invalid' })

    const { result } = renderHook(() => useChatAttachment({ loadAttachment }))

    await act(async () => {
      await result.current.selectAttachment()
    })
    await act(async () => {
      await result.current.selectAttachment()
    })

    expect(result.current.attachmentFile).toBeNull()
    expect(result.current.attachmentError).toBe(getAttachmentErrorMessage())
  })

  // -----------------------------------------------------------------------------------------------
  // 添付ファイルの読み込みが失敗した場合、現在の添付ファイルは保持され、エラーメッセージが設定されることを確認する
  // -----------------------------------------------------------------------------------------------
  it('keeps the current attachment when loading fails', async () => {
    const attachment = createAttachment()
    const loadAttachment = vi
      .fn<LoadChatAttachment>()
      .mockResolvedValueOnce({ status: 'selected', attachment })
      .mockResolvedValueOnce({ status: 'failed' })

    const { result } = renderHook(() => useChatAttachment({ loadAttachment }))

    await act(async () => {
      await result.current.selectAttachment()
    })
    await act(async () => {
      await result.current.selectAttachment()
    })

    expect(result.current.attachmentFile).toEqual(attachment)
    expect(result.current.attachmentError).toBe(getAttachmentErrorMessage())
  })

  // -----------------------------------------------------------------------------------------------
  // 添付ファイルの選択がキャンセルされた場合、現在の添付ファイルは保持され、エラーメッセージはクリアされることを確認する
  // -----------------------------------------------------------------------------------------------
  it('keeps the current attachment and clears the error when selection is canceled', async () => {
    const attachment = createAttachment()
    const loadAttachment = vi
      .fn<LoadChatAttachment>()
      .mockResolvedValueOnce({ status: 'selected', attachment })
      .mockResolvedValueOnce({ status: 'failed' })
      .mockResolvedValueOnce({ status: 'canceled' })

    const { result } = renderHook(() => useChatAttachment({ loadAttachment }))

    await act(async () => {
      await result.current.selectAttachment()
    })
    await act(async () => {
      await result.current.selectAttachment()
    })
    await act(async () => {
      await result.current.selectAttachment()
    })

    expect(result.current.attachmentFile).toEqual(attachment)
    expect(result.current.attachmentError).toBeNull()
  })

  // -----------------------------------------------------------------------------------------------
  // 予期しないローダーエラーが発生した場合、失敗した読み込みとして扱われることを確認する
  // -----------------------------------------------------------------------------------------------
  it('treats unexpected loader errors as failed loads', async () => {
    const attachment = createAttachment()
    const loadAttachment = vi
      .fn<LoadChatAttachment>()
      .mockResolvedValueOnce({ status: 'selected', attachment })
      .mockRejectedValueOnce(new Error('unexpected'))

    const { result } = renderHook(() => useChatAttachment({ loadAttachment }))

    await act(async () => {
      await result.current.selectAttachment()
    })
    await act(async () => {
      await result.current.selectAttachment()
    })

    expect(result.current.attachmentFile).toEqual(attachment)
    expect(result.current.attachmentError).toBe(getAttachmentErrorMessage())
  })

  // -----------------------------------------------------------------------------------------------
  // 添付ファイルとエラーメッセージを同時にクリアできることを確認する
  // -----------------------------------------------------------------------------------------------
  it('clears the attachment and error together', async () => {
    const attachment = createAttachment()
    const loadAttachment = vi
      .fn<LoadChatAttachment>()
      .mockResolvedValueOnce({ status: 'selected', attachment })

    const { result } = renderHook(() => useChatAttachment({ loadAttachment }))

    await act(async () => {
      await result.current.selectAttachment()
    })
    act(() => {
      result.current.clearAttachment()
    })

    expect(result.current.attachmentFile).toBeNull()
    expect(result.current.attachmentError).toBeNull()
  })
})

describe('createChatAttachmentMessagePart', () => {
  // -----------------------------------------------------------------------------------------------
  // 添付ファイルのテキストパートが正しく作成されることを確認する
  // -----------------------------------------------------------------------------------------------
  it('creates the text part used for chat attachments', () => {
    const attachment = createAttachment({ name: 'note.md', size: 7, content: '# title' })

    expect(createChatAttachmentMessagePart(attachment)).toEqual({
      type: 'text',
      content: '\n\n<attachment name="note.md" size="7">\n# title\n</attachment>',
      metadata: {
        kind: 'chat-attachment',
        name: 'note.md',
        size: 7,
      },
    })
  })
})

describe('isAllowedChatAttachment', () => {
  // -----------------------------------------------------------------------------------------------
  // 添付ファイルの拡張子とサイズが許可されているかどうかを判定する
  // -----------------------------------------------------------------------------------------------
  it.each([
    { file: { isFile: true, extension: '.txt', size: 1024 * 1024 }, expected: true },
    { file: { isFile: true, extension: '.MD', size: 100 }, expected: true },
    { file: { isFile: true, extension: '.pdf', size: 100 }, expected: false },
    { file: { isFile: true, extension: '.txt', size: 1024 * 1024 + 1 }, expected: false },
    { file: { isFile: false, extension: '.txt', size: 100 }, expected: false },
  ])('returns $expected for $file.extension size $file.size', ({ file, expected }) => {
    expect(isAllowedChatAttachment(file)).toBe(expected)
  })
})

describe('isChatAttachmentTextPart', () => {
  // -----------------------------------------------------------------------------------------------
  // テキストパートがチャット添付ファイルのメタデータを持っているかどうかを判定する
  // -----------------------------------------------------------------------------------------------
  it('detects chat attachment metadata on text parts', () => {
    const attachmentPart = {
      type: 'text',
      content: 'hidden attachment prompt',
      metadata: {
        kind: 'chat-attachment',
        name: 'memo.txt',
        size: 5,
      },
    } as MessagePart

    expect(isChatAttachmentTextPart(attachmentPart)).toBe(true)
  })

  // -----------------------------------------------------------------------------------------------
  // チャット添付ファイルのメタデータを持たないテキストパートは拒否されることを確認する
  // -----------------------------------------------------------------------------------------------
  it('rejects non-attachment text parts', () => {
    expect(isChatAttachmentTextPart({ type: 'text', content: 'hello' } as MessagePart)).toBe(false)
    expect(
      isChatAttachmentTextPart({
        type: 'text',
        content: 'hello',
        metadata: {
          kind: 'other', // 不正な kind
          name: 'memo.txt',
          size: 5,
        },
      } as MessagePart),
    ).toBe(false)
  })
})

function createAttachment(overrides: Partial<ChatAttachment> = {}): ChatAttachment {
  return {
    name: 'memo.txt',
    size: 5,
    content: 'hello',
    ...overrides,
  }
}
