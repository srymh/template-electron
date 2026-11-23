import { useCallback, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { MultimodalContent } from '@tanstack/ai-client'

import { loadChatAttachmentFromFileSystem } from '../utils/load-chat-attachment-from-file-system'
import { useChatAttachment } from './use-chat-attachment'
import type { ChatAttachment } from './use-chat-attachment'

type Submission = {
  input: string
  attachment: ChatAttachment | null
  revision: number
  accepted: boolean
}

/**
 * セッションの下書きと送信中の退避を保持する。
 * SDK の onResponse で受付を確認して下書きを消し、onError で復元する。
 * @returns 入力・添付の操作と、SDK へ接続する送信・受付・失敗の処理
 */
export function useChatDraft() {
  const [input, updateInput] = useState('')
  const [error, setError] = useState<Error>()
  const [isSending, setIsSending] = useState(false)
  const revisionRef = useRef(0)
  const submissionRef = useRef<Submission | null>(null)
  const {
    attachmentFile,
    attachmentError,
    setAttachment,
    selectAttachment,
    clearAttachment,
    clearAttachmentError,
    createAttachmentMessagePart,
  } = useChatAttachment({ loadAttachment: loadChatAttachmentFromFileSystem })

  // ユーザーが下書きを変更したら、古い要求の失敗で上書きしない。
  const setInput: Dispatch<SetStateAction<string>> = useCallback((next) => {
    revisionRef.current += 1
    updateInput(next)
  }, [])
  const selectDraftAttachment = async () => {
    revisionRef.current += 1
    await selectAttachment()
  }
  const clearDraftAttachment = () => {
    revisionRef.current += 1
    clearAttachment()
  }

  const onResponse = useCallback(() => {
    // この SDK の onResponse はユーザーメッセージを履歴へ追加した後に呼ばれる。
    // Promise の解決は生成完了まで待つため、受付の判定には使わない。
    setError(undefined)
    const submission = submissionRef.current
    if (!submission || submission.accepted) return
    submission.accepted = true
    if (revisionRef.current !== submission.revision) return
    updateInput('')
    clearAttachment()
  }, [clearAttachment])

  const onError = useCallback(
    (cause: unknown) => {
      setError(toSubmissionError(cause))
      const submission = submissionRef.current
      if (!submission?.accepted || revisionRef.current !== submission.revision) return
      updateInput(submission.input)
      setAttachment(submission.attachment)
      submission.accepted = false
    },
    [setAttachment],
  )

  const sendDraft = async (sendMessage: (content: MultimodalContent) => Promise<void>) => {
    if (submissionRef.current || !input.trim()) return
    const submission: Submission = {
      input,
      attachment: attachmentFile,
      revision: revisionRef.current,
      accepted: false,
    }
    submissionRef.current = submission
    setIsSending(true)
    setError(undefined)
    clearAttachmentError()
    try {
      await sendMessage({
        content: [
          { type: 'text', content: input },
          ...(attachmentFile ? [createAttachmentMessagePart(attachmentFile)] : []),
        ],
      })
    } catch (cause) {
      onError(cause)
    } finally {
      // 完了・停止では下書きに触れず、ダイアログ再表示後の新しい入力を守る。
      submissionRef.current = null
      setIsSending(false)
    }
  }

  return {
    state: {
      input,
      setInput,
      attachmentFile,
      attachmentError,
      selectAttachment: selectDraftAttachment,
      clearAttachment: clearDraftAttachment,
      isSending,
      error,
    },
    onResponse,
    onError,
    sendDraft,
  }
}

/**
 * SDK の例外とエラー集合を、画面で読めるエラーへ揃える。
 * @param cause - SDK または送信処理が通知した失敗
 * @returns 詳細を持つエラー。解釈できない値には固定の案内を使う
 */
function toSubmissionError(cause: unknown): Error {
  if (cause instanceof Error) return cause
  if (typeof cause === 'string') return new Error(cause)
  if (cause && typeof cause === 'object') {
    if ('message' in cause && typeof cause.message === 'string') return new Error(cause.message)
    if ('errors' in cause && Array.isArray(cause.errors)) {
      const messages = cause.errors.map((item: unknown) => toSubmissionError(item).message)
      if (messages.length > 0) return new Error(messages.join('\n'))
    }
  }
  return new Error('チャットの送信に失敗しました。もう一度お試しください。')
}
