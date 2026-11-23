import { useState } from 'react'
import type { ComponentProps } from 'react'

import type { TextPart } from '@tanstack/ai-client'
import { FileTextIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
} from '@repo/ui/components/alert-dialog'

import { isChatAttachmentTextPart } from '../../hooks/use-chat-attachment'
import type { ChatAttachmentMetadata } from '../../hooks/use-chat-attachment'
import { formatBytes } from '../../utils/format-bytes'
import { toSafeExternalHref } from '../../utils/to-safe-external-href'

export function TextContent({ part }: { part: TextPart }) {
  if (isChatAttachmentTextPart(part)) {
    return <AttachmentPart metadata={part.metadata} />
  }

  return (
    <div className="w-full overflow-x-auto">
      <MarkdownContentView content={part.content} />
    </div>
  )
}

/** チャットの Markdown を表示し、外部リンクを開く前に確認を求める。 */
function MarkdownContentView({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => <h1 className="mt-6 mb-3 text-2xl font-bold" {...props} />,
        h2: (props) => <h2 className="mt-5 mb-2 text-xl font-bold" {...props} />,
        h3: (props) => <h3 className="mt-4 mb-2 text-lg font-semibold" {...props} />,

        p: (props) => <p className="my-3 leading-7" {...props} />,
        ul: (props) => <ul className="my-3 list-disc pl-6" {...props} />,
        ol: (props) => <ol className="my-3 list-decimal pl-6" {...props} />,
        li: (props) => <li className="my-1" {...props} />,

        a: MarkdownLink,

        code: ({ className, children, ...props }) => {
          const isBlock = /language-/.test(className || '')
          if (isBlock)
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          return (
            <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.9em]" {...props}>
              {children}
            </code>
          )
        },
        pre: (props) => <pre className="my-4 overflow-x-auto rounded bg-black/5 p-3" {...props} />,

        table: (props) => <table className="my-4 w-full border-collapse" {...props} />,
        th: (props) => <th className="border bg-black/5 px-2 py-1 text-left" {...props} />,
        td: (props) => <td className="border px-2 py-1 align-top" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

/** 外部 URL を確認ダイアログで提示し、承認されたときに開く。 */
function MarkdownLink({ href, node: _node, ...props }: ComponentProps<'a'> & ExtraProps) {
  const [open, setOpen] = useState(false)
  const safeHref = toSafeExternalHref(href)

  if (!safeHref) {
    return <span className="text-muted-foreground underline underline-offset-4" {...props} />
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        nativeButton={false}
        render={<span className="cursor-pointer underline underline-offset-4" {...props} />}
      />
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
              setOpen(false)
              window.open(safeHref, '_blank', 'noopener,noreferrer')
            }}
          >
            アクセス
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function AttachmentPart({ metadata }: { metadata: ChatAttachmentMetadata }) {
  return (
    <div className="border-border bg-muted/40 text-muted-foreground flex min-w-0 items-center gap-2 rounded border px-2 py-1 text-xs">
      <FileTextIcon className="size-3.5 shrink-0" />
      <span className="truncate">{metadata.name}</span>
      <span className="shrink-0">{formatBytes(metadata.size)}</span>
    </div>
  )
}
