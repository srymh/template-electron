import type { Model } from '@repo/ai/shared'
import { Separator } from '@repo/ui/components/separator'
import { toast } from '@repo/ui/components/toast'
import { aiChat } from '@your-app-name/api/renderer'

import { loadChatAttachmentFromFileSystem } from '../utils/load-chat-attachment-from-file-system'
import { useChatSession } from './chat-session-provider'
import {
  ComposerAttachmentPreview,
  Composer,
  ComposerActions,
  ComposerAttachmentError,
  ComposerInputGroup,
  ComposerSendButton,
  ComposerTextarea,
  ComposerAddMenu,
  ComposerAttachTextFileItem,
  ComposerSaveKnowledgeItem,
} from './composer'
import { MessageBody, MessageHeader, MessageParts, Messages } from './message'
import { NotImplementedPartContent } from './parts/not-implemented-part-content'
import { TextContent } from './parts/text-content'
import { ThinkingContent } from './parts/thinking-content'
import { ToolCallContent } from './parts/tool-call-content'
import { ToolResultContent } from './parts/tool-result-content'
import { SelectModel } from './select-model'

/** メッセージ一覧と入力欄を表示し、添付・送信・生成停止の操作を接続する。 */
export function Chat({
  selectedModel,
  setSelectedModel,
  username,
}: {
  selectedModel: Model
  setSelectedModel: (model: Model) => void
  username?: string
}) {
  const displayUsername = username || 'あなた'

  const { isNotAvailable, composer, messages, isLoading, status, error, interrupts, resuming } =
    useChatSession()

  const {
    input,
    setInput,
    attachmentFile,
    attachmentError,
    selectAttachment,
    clearAttachment,
    isSending,
    submit,
  } = composer
  const isAwaitingInterrupt = interrupts.length > 0 || resuming

  const saveKnowledgeFromFile = async () => {
    const result = await loadChatAttachmentFromFileSystem({
      title: '知識に保存するファイルを選択',
      message: '知識として保存するテキストファイルを選択してください',
    })
    if (result.status === 'selected' && result.attachment) {
      await aiChat.ingestDocument(result.attachment.content)
      toast.add({
        title: '知識に保存しました。次回以降、AI が必要に応じて参照します。',
        type: 'success',
      })
    } else if (result.status === 'canceled') {
      toast.add({ title: '知識への保存をキャンセルしました。', type: 'error' })
    } else {
      toast.add({ title: '知識への保存に失敗しました。', type: 'error' })
    }
  }

  const disabledInput = isLoading || isSending || isNotAvailable || isAwaitingInterrupt
  const disabledKnowledgeSave = isLoading || isNotAvailable
  const disabledSubmit =
    isNotAvailable || (!isLoading && (isAwaitingInterrupt || isSending || !input.trim()))

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
      <div className="flex shrink-0 justify-end">
        <SelectModel selectedModel={selectedModel} setSelectedModel={setSelectedModel} />
      </div>

      <Messages messages={messages}>
        {(message) => (
          <>
            <MessageHeader message={message} username={displayUsername} />
            <Separator />
            <MessageBody>
              <MessageParts messageParts={message.parts}>
                {(part) => {
                  switch (part.type) {
                    case 'text':
                      return <TextContent part={part} />

                    case 'thinking':
                      return <ThinkingContent part={part} />

                    case 'tool-call':
                      return (
                        <ToolCallContent
                          part={part}
                          approval={interrupts
                            .filter((interrupt) => interrupt.kind === 'tool-approval')
                            .find((interrupt) => interrupt.toolCallId === part.id)}
                          resuming={resuming}
                        />
                      )

                    case 'tool-result':
                      return <ToolResultContent part={part} />

                    case 'image':
                      return <NotImplementedPartContent part={part} />

                    case 'document':
                      return <NotImplementedPartContent part={part} />

                    case 'audio':
                      return <NotImplementedPartContent part={part} />

                    case 'video':
                      return <NotImplementedPartContent part={part} />

                    case 'structured-output':
                      return <NotImplementedPartContent part={part} />

                    default:
                      return <NotImplementedPartContent part={part} />
                  }
                }}
              </MessageParts>
            </MessageBody>
          </>
        )}
      </Messages>

      {/* 送信拒否と、SDK が受信したストリーム・IPC エラーの詳細を示す。 */}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error.message}
        </p>
      )}

      <Composer onSubmit={submit}>
        <ComposerAttachmentPreview attachment={attachmentFile} onClear={clearAttachment} />
        <ComposerAttachmentError error={attachmentError} />
        <ComposerInputGroup>
          <ComposerTextarea
            value={input}
            status={status}
            disabled={disabledInput}
            onValueChange={setInput}
          />
          <ComposerActions>
            <ComposerAddMenu>
              <ComposerAttachTextFileItem disabled={disabledInput} onClick={selectAttachment} />
              <ComposerSaveKnowledgeItem
                disabled={disabledKnowledgeSave}
                onClick={saveKnowledgeFromFile}
              />
            </ComposerAddMenu>
            <ComposerSendButton isLoading={isLoading} disabled={disabledSubmit} />
          </ComposerActions>
        </ComposerInputGroup>
      </Composer>
    </div>
  )
}
