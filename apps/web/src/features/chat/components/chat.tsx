import ReactMarkdown from 'react-markdown'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@workspace/ui/components/accordion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@workspace/ui/components/alert-dialog'
import { Field } from '@workspace/ui/components/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@workspace/ui/components/input-group'
import { Separator } from '@workspace/ui/components/separator'
import { ArrowUpIcon, BotIcon, SquareIcon, User2Icon } from 'lucide-react'
import remarkGfm from 'remark-gfm'

import { useAuth } from '@/features/auth/api/auth'
import { useChatSession } from '@/features/chat/components/chat-session-provider'
import { useAutoScrollToBottom } from '@/hooks/use-auto-scroll-to-bottom'

export function Chat() {
  const {
    auth: { user },
  } = useAuth()
  const username = user?.username || 'あなた'

  const { isNotAvailable, input, setInput, messages, sendMessage, isLoading, stop, status } =
    useChatSession()

  const { scrollContainerRef, scrollBottomRef, onScroll } = useAutoScrollToBottom([messages])

  const send = () => {
    if (isLoading) {
      // 生成中に送信された場合は、生成停止とみなす
      stop()
    } else {
      // 生成中でない場合は、通常の送信処理
      if (!input.trim()) {
        return
      }
      sendMessage(input)
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

  return (
    <div className="flex min-h-0 flex-1 flex-col w-full gap-4">
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-4"
      >
        {messages.map((msg) => (
          <div key={msg.id} className="border border-border rounded bg-background text-foreground">
            <div className="p-2">
              {msg.role === 'assistant' ? (
                <div className="flex items-end gap-1">
                  <BotIcon className="size-5 text-primary" />
                  <span className="font-bold">Assistant</span>
                </div>
              ) : msg.role === 'user' ? (
                <div className="flex items-end gap-1">
                  <User2Icon className="size-5 text-primary" />
                  <span className="font-bold">{username}</span>
                </div>
              ) : (
                msg.role
              )}
            </div>

            <Separator />

            <div className="p-2 flex flex-col gap-1">
              {msg.parts.map((part, idx) => {
                const key = `${part.type}-${idx}`

                switch (part.type) {
                  case 'text':
                    return (
                      <div key={key}>
                        <TextContent content={part.content} />
                      </div>
                    )
                  case 'thinking':
                    return (
                      <Accordion
                        type="single"
                        collapsible
                        className="italic bg-muted text-muted-foreground overflow-auto"
                        key={key}
                      >
                        <AccordionItem value={key}>
                          <AccordionTrigger>Thinking</AccordionTrigger>
                          <AccordionContent className="h-fit">{part.content}</AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )
                  case 'tool-call':
                    return (
                      <Accordion
                        type="single"
                        collapsible
                        className="italic bg-muted text-muted-foreground overflow-auto"
                        key={key}
                      >
                        <AccordionItem value={key}>
                          <AccordionTrigger>Tool Call: {part.name}</AccordionTrigger>
                          <AccordionContent>
                            <pre className="font-mono not-italic">
                              {JSON.stringify(part, null, 2)}
                            </pre>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )
                  case 'tool-result':
                    return (
                      <Accordion
                        type="single"
                        collapsible
                        className="italic bg-muted text-muted-foreground overflow-auto"
                        key={key}
                      >
                        <AccordionItem value={key}>
                          <AccordionTrigger>Tool Result</AccordionTrigger>
                          <AccordionContent>
                            <pre className="font-mono not-italic">
                              {JSON.stringify(part, null, 2)}
                            </pre>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )
                  case 'image':
                    return <div key={key}>Not Implemented</div>
                  case 'document':
                    return <div key={key}>Not Implemented</div>
                  case 'audio':
                    return <div key={key}>Not Implemented</div>
                  case 'video':
                    return <div key={key}>Not Implemented</div>
                  default:
                    return <div key={key}>Unknown part type: {(part as any).type}</div>
                }
              })}
            </div>
          </div>
        ))}

        <div ref={scrollBottomRef} />
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <Field>
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
            <InputGroupAddon align="block-end">
              <InputGroupButton
                variant="default"
                size="sm"
                type="submit"
                className="ml-auto"
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

function TextContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => <h1 className="text-2xl font-bold mt-6 mb-3" {...props} />,
        h2: (props) => <h2 className="text-xl font-bold mt-5 mb-2" {...props} />,
        h3: (props) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />,

        p: (props) => <p className="my-3 leading-7" {...props} />,
        ul: (props) => <ul className="list-disc pl-6 my-3" {...props} />,
        ol: (props) => <ol className="list-decimal pl-6 my-3" {...props} />,
        li: (props) => <li className="my-1" {...props} />,

        a: ({ href, ...props }) => {
          const safeHref = toSafeExternalHref(href)

          if (!safeHref) {
            return (
              <span className="underline underline-offset-4 text-muted-foreground" {...props} />
            )
          }

          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <span className="underline underline-offset-4" {...props} />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>外部リンクにアクセスしようとしています</AlertDialogTitle>
                  <AlertDialogDescription className="overflow-auto">
                    本当にアクセスしますか？
                    <br />
                    {href}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      window.open(safeHref, '_blank', 'noopener,noreferrer')
                    }}
                  >
                    アクセス
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        },

        code: ({ className, children, ...props }) => {
          const isBlock = /language-/.test(className || '')
          if (isBlock)
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          return (
            <code className="px-1 py-0.5 rounded bg-black/5 font-mono text-[0.9em]" {...props}>
              {children}
            </code>
          )
        },
        pre: (props) => <pre className="my-4 p-3 rounded overflow-x-auto bg-black/5" {...props} />,

        table: (props) => <table className="my-4 w-full border-collapse" {...props} />,
        th: (props) => <th className="border px-2 py-1 text-left bg-black/5" {...props} />,
        td: (props) => <td className="border px-2 py-1 align-top" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function toSafeExternalHref(href: string | undefined): string | undefined {
  if (!href) return undefined

  // 相対リンクやアンカーは、チャット本文（非信頼）では無効化する。
  if (href.startsWith('/') || href.startsWith('#')) return undefined

  try {
    const url = new URL(href)
    if (url.username || url.password) return undefined

    switch (url.protocol) {
      case 'https:':
      case 'http:':
      case 'mailto:':
        return url.toString()
      default:
        return undefined
    }
  } catch {
    return undefined
  }
}
