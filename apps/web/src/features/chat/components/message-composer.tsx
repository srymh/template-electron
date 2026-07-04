import React from 'react'

import type { ChatClientState } from '@tanstack/ai-client'
import { ArrowUpIcon, FileTextIcon, PlusIcon, SquareIcon, XIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Field, FieldError } from '@repo/ui/components/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@repo/ui/components/input-group'

import type { ChatAttachment } from '../hooks/use-chat-attachment'
import { formatBytes } from '../utils/format-bytes'

export type MessageComposerProps = {
  value: string
  status: ChatClientState
  isLoading: boolean
  isNotAvailable: boolean
  attachment: ChatAttachment | null
  attachmentError: string | null
  onValueChange: (value: string) => void
  onSubmit: () => void
  onSelectAttachment: () => void
  onClearAttachment: () => void
}

export function MessageComposer({
  value,
  status,
  isLoading,
  isNotAvailable,
  attachment,
  attachmentError,
  onValueChange,
  onSubmit,
  onSelectAttachment,
  onClearAttachment,
}: MessageComposerProps) {
  const disabledAttachment = isLoading || isNotAvailable
  const disabledSubmit = (status === 'ready' && !value.trim()) || isNotAvailable

  const handleSubmit: React.SubmitEventHandler = (e) => {
    e.preventDefault()
    onSubmit()
  }

  const handleKeyDown: React.KeyboardEventHandler = (e) => {
    // Ctrl+Enter で送信
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <Field>
        <AttachmentPreview attachment={attachment} onClear={onClearAttachment} />
        <FieldError>{attachmentError}</FieldError>
        <InputGroup>
          <ComposerTextarea
            value={value}
            status={status}
            disabled={isLoading || isNotAvailable}
            onValueChange={onValueChange}
          />
          <ComposerActions
            isLoading={isLoading}
            disabledAttachment={disabledAttachment}
            disabledSubmit={disabledSubmit}
            onSelectAttachment={onSelectAttachment}
          />
        </InputGroup>
      </Field>
    </form>
  )
}

function AttachmentPreview({
  attachment,
  onClear,
}: {
  attachment: ChatAttachment | null
  onClear: () => void
}) {
  if (!attachment) return null

  return (
    <div className="flex min-w-0 items-center gap-2 rounded border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
      <FileTextIcon className="size-3.5 shrink-0" />
      <span className="truncate">{attachment.name}</span>
      <span className="shrink-0">{formatBytes(attachment.size)}</span>
      <Button type="button" variant="ghost" size="icon-xs" className="ml-auto" onClick={onClear}>
        <XIcon />
      </Button>
    </div>
  )
}

function ComposerTextarea({
  value,
  status,
  disabled,
  onValueChange,
}: {
  value: string
  status: ChatClientState
  disabled: boolean
  onValueChange: (value: string) => void
}) {
  return (
    <InputGroupTextarea
      placeholder={getComposerPlaceholder(status)}
      className="min-h-[120px] max-h-[200px]"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
    />
  )
}

function ComposerActions({
  isLoading,
  disabledAttachment,
  disabledSubmit,
  onSelectAttachment,
}: {
  isLoading: boolean
  disabledAttachment: boolean
  disabledSubmit: boolean
  onSelectAttachment: () => void
}) {
  return (
    <InputGroupAddon align="block-end" className="justify-between">
      <AttachButton disabled={disabledAttachment} onClick={onSelectAttachment} />
      <SendButton disabled={disabledSubmit} isLoading={isLoading} />
    </InputGroupAddon>
  )
}

function AttachButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <InputGroupButton
      variant="outline"
      size="sm"
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <PlusIcon className="fill-primary-foreground" />
    </InputGroupButton>
  )
}

function SendButton({ disabled, isLoading }: { disabled: boolean; isLoading: boolean }) {
  return (
    <InputGroupButton variant="default" size="sm" type="submit" disabled={disabled}>
      {isLoading ? <SquareIcon className="fill-primary-foreground" /> : <ArrowUpIcon />}
    </InputGroupButton>
  )
}

function getComposerPlaceholder(status: ChatClientState) {
  switch (status) {
    case 'ready':
      return 'メッセージを入力... (Ctrl+Enterで送信)'
    case 'submitted':
      return '送信しました。応答を待っています...'
    case 'streaming':
      return '応答を生成中...'
    case 'error':
      return 'エラーが発生しました。'
    default:
      return 'メッセージを入力...'
  }
}
