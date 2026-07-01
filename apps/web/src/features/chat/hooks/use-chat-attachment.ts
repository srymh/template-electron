import * as React from 'react'

import type { MessagePart } from '@tanstack/ai-client'

import { formatBytes } from '../utils/format-bytes'

const CHAT_ATTACHMENT_METADATA_KIND = 'chat-attachment'
export const CHAT_ATTACHMENT_MAX_BYTES = 1024 * 1024
export const CHAT_ATTACHMENT_EXTENSIONS = ['txt', 'md'] as const
export const CHAT_ATTACHMENT_ALLOWED_EXTENSIONS = CHAT_ATTACHMENT_EXTENSIONS.map(
  (extension) => `.${extension}`,
)

export type ChatAttachment = {
  name: string
  size: number
  content: string
}

export type ChatAttachmentMetadata = {
  kind: typeof CHAT_ATTACHMENT_METADATA_KIND
  name: string
  size: number
}

export type ChatAttachmentFileDetails = {
  isFile: boolean
  extension: string
  size: number
}

export type ChatAttachmentLoadResult =
  | { status: 'selected'; attachment: ChatAttachment }
  | { status: 'canceled' }
  | { status: 'invalid' }
  | { status: 'failed' }

export type LoadChatAttachment = () => Promise<ChatAttachmentLoadResult>

export type UseChatAttachmentOptions = {
  /**
   * 添付ファイルをロードするための関数。
   * ファイル選択ダイアログを開き、ユーザーが選択したファイルを読み込む処理を実装する。
   */
  loadAttachment: LoadChatAttachment
}

/**
 * チャット添付ファイルの選択状態とエラー状態を管理する。
 *
 * @returns 添付ファイル UI から利用するための API。
 * - `attachmentFile`: 現在選択されている添付ファイル。未選択時は `null`。
 * - `attachmentError`: 直近の選択エラー文言。正常時は `null`。
 * - `selectAttachment`: ファイル選択を実行し、結果に応じて添付状態とエラー状態を更新する。
 * - `clearAttachment`: 添付ファイルとエラー状態を同時にクリアする。
 * - `clearAttachmentError`: エラー状態だけをクリアする。
 * - `createAttachmentMessagePart`: 添付ファイルを送信用のテキストメッセージパートへ変換する。
 */
export function useChatAttachment(options: UseChatAttachmentOptions) {
  const { loadAttachment } = options

  const [attachmentFile, setAttachmentFile] = React.useState<ChatAttachment | null>(null)
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null)

  const clearAttachmentError = React.useCallback(() => {
    setAttachmentError(null)
  }, [])

  const clearAttachment = React.useCallback(() => {
    setAttachmentFile(null)
    setAttachmentError(null)
  }, [])

  const selectAttachment = React.useCallback(async () => {
    setAttachmentError(null)

    let result: ChatAttachmentLoadResult
    try {
      result = await loadAttachment()
    } catch {
      setAttachmentError(getAttachmentErrorMessage())
      return
    }

    switch (result.status) {
      case 'selected':
        setAttachmentFile(result.attachment)
        return
      case 'invalid':
        setAttachmentFile(null)
        setAttachmentError(getAttachmentErrorMessage())
        return
      case 'failed':
        setAttachmentError(getAttachmentErrorMessage())
        return
      case 'canceled':
        return
    }
  }, [loadAttachment])

  return {
    attachmentFile,
    attachmentError,
    selectAttachment,
    clearAttachment,
    clearAttachmentError,
    createAttachmentMessagePart: createChatAttachmentMessagePart,
  }
}

export function createChatAttachmentMessagePart(attachment: ChatAttachment) {
  return {
    type: 'text' as const,
    content: toAttachmentPrompt(attachment),
    metadata: toAttachmentMetadata(attachment),
  }
}

export function isChatAttachmentTextPart(
  part: MessagePart,
): part is MessagePart & { type: 'text'; metadata: ChatAttachmentMetadata } {
  if (part.type !== 'text' || !('metadata' in part)) {
    return false
  }

  const metadata = (part as { metadata?: unknown }).metadata
  if (metadata == null || typeof metadata !== 'object') {
    return false
  }

  const candidate = metadata as Record<string, unknown>
  return (
    candidate.kind === CHAT_ATTACHMENT_METADATA_KIND &&
    typeof candidate.name === 'string' &&
    typeof candidate.size === 'number'
  )
}

function toAttachmentMetadata(attachment: ChatAttachment): ChatAttachmentMetadata {
  return {
    kind: CHAT_ATTACHMENT_METADATA_KIND,
    name: attachment.name,
    size: attachment.size,
  }
}

function toAttachmentPrompt(attachment: ChatAttachment) {
  return [
    '',
    '',
    `<attachment name="${attachment.name}" size="${attachment.size}">`,
    attachment.content,
    '</attachment>',
  ].join('\n')
}

export function getAttachmentErrorMessage() {
  return `${CHAT_ATTACHMENT_ALLOWED_EXTENSIONS.join('/')} 形式で ${formatBytes(CHAT_ATTACHMENT_MAX_BYTES)} 以下のファイルを選択してください。`
}

export function isAllowedChatAttachment(file: ChatAttachmentFileDetails) {
  return (
    file.isFile &&
    CHAT_ATTACHMENT_ALLOWED_EXTENSIONS.includes(file.extension.toLowerCase()) &&
    file.size <= CHAT_ATTACHMENT_MAX_BYTES
  )
}
