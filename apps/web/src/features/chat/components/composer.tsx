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

export function Composer({
  children,
  onSubmit,
}: {
  children: React.ReactNode
  onSubmit: () => void
}) {
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
      <Field>{children}</Field>
    </form>
  )
}

export function ComposerAttachmentPreview({
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

export function ComposerAttachmentError({ error }: { error: string | null }) {
  if (!error) return null

  return <FieldError>{error}</FieldError>
}

export function ComposerInputGroup({ children }: { children: React.ReactNode }) {
  return <InputGroup>{children}</InputGroup>
}

export function ComposerTextarea({
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

export function ComposerActions({ children }: { children: React.ReactNode }) {
  return (
    <InputGroupAddon align="block-end" className="justify-between">
      {children}
    </InputGroupAddon>
  )
}

export function ComposerAttachButton({
  disabled,
  onClick,
}: {
  disabled: boolean
  onClick: () => void
}) {
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

export function ComposerSendButton({
  disabled,
  isLoading,
}: {
  disabled: boolean
  isLoading: boolean
}) {
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
