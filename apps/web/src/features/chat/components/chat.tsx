import { toast } from 'sonner'

import { Separator } from '@repo/ui/components/separator'
import { aiChat } from '@your-app-name/api/renderer'

import { useAuth } from '@/features/auth/api/auth'

import { useChatAttachment } from '../hooks/use-chat-attachment'
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

export function Chat() {
  const {
    auth: { user },
  } = useAuth()
  const username = user?.username || 'あなた'

  const {
    isNotAvailable,
    input,
    setInput,
    messages,
    sendMessage,
    isLoading,
    stop,
    status,
    addToolApprovalResponse,
  } = useChatSession()

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

  const saveKnowledgeFromFile = async () => {
    const result = await loadChatAttachmentFromFileSystem({
      title: '知識に保存するファイルを選択',
      message: '知識として保存するテキストファイルを選択してください',
    })
    if (result.status === 'selected' && result.attachment) {
      await aiChat.ingestDocument(result.attachment.content)
      toast.success('知識に保存しました。次回以降、AI が必要に応じて参照します。')
    } else if (result.status === 'canceled') {
      toast.error('知識への保存をキャンセルしました。')
    } else {
      toast.error('知識への保存に失敗しました。')
    }
  }

  const disabledTextFileAttachment = isLoading || isNotAvailable
  const disabledKnowledgeSave = isLoading || isNotAvailable
  const disabledSubmit = (status === 'ready' && !input.trim()) || isNotAvailable

  return (
    <div className="flex min-h-0 flex-1 flex-col w-full gap-4">
      <Messages messages={messages}>
        {(message) => (
          <>
            <MessageHeader message={message} username={username} />
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
                          addToolApprovalResponse={addToolApprovalResponse}
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

      <Composer onSubmit={send}>
        <ComposerAttachmentPreview attachment={attachmentFile} onClear={clearAttachment} />
        <ComposerAttachmentError error={attachmentError} />
        <ComposerInputGroup>
          <ComposerTextarea
            value={input}
            status={status}
            disabled={isLoading || isNotAvailable}
            onValueChange={setInput}
          />
          <ComposerActions>
            <ComposerAddMenu>
              <ComposerAttachTextFileItem
                disabled={disabledTextFileAttachment}
                onClick={selectAttachment}
              />
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
