import React from 'react'

import { ArrowUpIcon, FileTextIcon, PlusIcon, SquareIcon, XIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Field } from '@repo/ui/components/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@repo/ui/components/input-group'
import { Separator } from '@repo/ui/components/separator'

import { useAuth } from '@/features/auth/api/auth'

import { useChatAttachment } from '../hooks/use-chat-attachment'
import { formatBytes } from '../utils/format-bytes'
import { loadChatAttachmentFromFileSystem } from '../utils/load-chat-attachment-from-file-system'
import { useChatSession } from './chat-session-provider'
import { Message, MessageBody, MessageHeader, Messages } from './message'
import { MessagePart, MessageParts } from './message-part'

export function Chat() {
  const {
    auth: { user },
  } = useAuth()
  const username = user?.username || 'あなた'

  const { isNotAvailable, input, setInput, messages, sendMessage, isLoading, stop, status } =
    useChatSession()

  const {
    attachmentFile,
    attachmentError,
    selectAttachment,
    clearAttachment,
    clearAttachmentError,
    createAttachmentMessagePart,
  } = useChatAttachment({ loadAttachment: loadChatAttachmentFromFileSystem })

  const send = () => {
    if (isLoading) {
      // 生成中に送信された場合は、生成停止とみなす
      stop()
    } else {
      // 生成中でない場合は、通常の送信処理
      if (!input.trim()) {
        return
      }

      if (attachmentFile) {
        clearAttachmentError()
        sendMessage({
          content: [
            {
              type: 'text',
              content: input,
            },
            createAttachmentMessagePart(attachmentFile),
          ],
        })
        clearAttachment()
      } else {
        clearAttachmentError()
        sendMessage(input)
      }

      setInput('')
    }
  }

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault()
    send()
  }

  const handleKeyDown: React.KeyboardEventHandler = (e) => {
    // Ctrl+Enter で送信
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      send()
    }
  }

  const disabled = status === 'ready' && !input.trim()
  const disabledAttachment = isLoading || isNotAvailable

  return (
    <div className="flex min-h-0 flex-1 flex-col w-full gap-4">
      <Messages messages={messages}>
        {(message) => (
          <Message key={message.id}>
            <MessageHeader message={message} username={username} />
            <Separator />
            <MessageBody>
              <MessageParts messageParts={message.parts}>
                {(part, idx) => <MessagePart key={`${part.type}-${idx}`} part={part} />}
              </MessageParts>
            </MessageBody>
          </Message>
        )}
      </Messages>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <Field>
          {attachmentFile ? (
            <div className="mb-2 flex min-w-0 items-center gap-2 rounded border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
              <FileTextIcon className="size-3.5 shrink-0" />
              <span className="truncate">{attachmentFile.name}</span>
              <span className="shrink-0">{formatBytes(attachmentFile.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="ml-auto"
                onClick={clearAttachment}
              >
                <XIcon />
              </Button>
            </div>
          ) : null}
          {attachmentError ? (
            <div className="mb-2 text-xs text-destructive">{attachmentError}</div>
          ) : null}
          <InputGroup>
            <InputGroupTextarea
              id="textarea-comment-31"
              placeholder={
                status === 'ready'
                  ? 'メッセージを入力... (Ctrl+Enterで送信)'
                  : status === 'submitted'
                    ? '送信しました。応答を待っています...'
                    : status === 'streaming'
                      ? '応答を生成中...'
                      : 'エラーが発生しました。'
              }
              className="min-h-[120px] max-h-[200px]"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || isNotAvailable}
            />
            <InputGroupAddon align="block-end" className="justify-between">
              <InputGroupButton
                variant="outline"
                size="sm"
                type="button"
                disabled={disabledAttachment}
                onClick={selectAttachment}
              >
                <PlusIcon className="fill-primary-foreground" />
              </InputGroupButton>
              <InputGroupButton
                variant="default"
                size="sm"
                type="submit"
                disabled={disabled || isNotAvailable}
              >
                {isLoading ? <SquareIcon className="fill-primary-foreground" /> : <ArrowUpIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </form>
    </div>
  )
}
