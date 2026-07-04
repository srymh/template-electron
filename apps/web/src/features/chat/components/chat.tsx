import { Separator } from '@repo/ui/components/separator'

import { useAuth } from '@/features/auth/api/auth'

import { useChatAttachment } from '../hooks/use-chat-attachment'
import { loadChatAttachmentFromFileSystem } from '../utils/load-chat-attachment-from-file-system'
import { useChatSession } from './chat-session-provider'
import { MessageBody, MessageHeader, MessageParts, Messages } from './message'
import { MessageComposer } from './message-composer'
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
                      return <ToolCallContent part={part} />

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

      <MessageComposer
        value={input}
        status={status}
        isLoading={isLoading}
        isNotAvailable={isNotAvailable}
        attachment={attachmentFile}
        attachmentError={attachmentError}
        onValueChange={setInput}
        onSubmit={send}
        onSelectAttachment={selectAttachment}
        onClearAttachment={clearAttachment}
      />
    </div>
  )
}
