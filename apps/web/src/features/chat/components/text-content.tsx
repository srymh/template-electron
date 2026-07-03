import ReactMarkdown from 'react-markdown'
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

import { toSafeExternalHref } from '../utils/to-safe-external-href'

export function TextContent({ content }: { content: string }) {
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
