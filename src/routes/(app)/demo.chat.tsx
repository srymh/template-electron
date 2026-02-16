import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { aiAgent, mcp } from '@/api'

export const Route = createFileRoute('/(app)/demo/chat')({
  component: RouteComponent,
  loader: () => ({ crumb: 'AIチャット' }),
})

const MODEL_NAME = import.meta.env.VITE_AI_AGENT_MODEL_NAME ?? '' // 使用するモデル名
const BASE_URL = import.meta.env.VITE_AI_AGENT_BASE_URL ?? '' // AIサーバーのベースURL
const API_KEY = import.meta.env.VITE_AI_AGENT_API_KEY ?? '' // 必要に応じてAPIキーを設定

const useAiAgent = () => {
  /**
   * AIエージェントの初期化状態
   */
  const [initialized, setInitialized] = React.useState<boolean>(false)

  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [isChunking, setIsChunking] = React.useState<boolean>(false)
  const [messages, setMessages] = React.useState<
    Array<{ role: 'user' | 'assistant'; content: string; isError?: boolean }>
  >([])
  const [chunkingMessage, setChunkingMessage] = React.useState<string>('')

  const send = React.useCallback(
    (message: string) => {
      setIsLoading(true)
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: message, isError: false },
      ])
      aiAgent.send({ message })
    },
    [setIsLoading, setMessages],
  )

  React.useEffect(() => {
    mcp
      .getServerStatus()
      .then((status) => {
        if (!status.isRunning) {
          mcp.startServer({})
        }

        // AIエージェントの初期化
        aiAgent
          .setup({
            instructions: '日本語で話してください。',
            modelName: MODEL_NAME,
            baseUrl: BASE_URL,
            apiKey: API_KEY,
            temperature: 0,
            mcpServerUrlList: ['http://localhost:3030/mcp'],
          })
          .then(() => {
            setInitialized(true)
          })
          .catch((error) => {
            console.error('AIエージェントの初期化に失敗しました:', error)
          })
      })
      .catch((error) => {
        console.error('MCPサーバーの状態取得に失敗しました:', error)
      })
  }, [])

  /**
   * リスナーの登録
   */
  React.useEffect(() => {
    const offChunk = aiAgent.on.chunk(({ answer }) => {
      setMessages((prev) => {
        setIsChunking(true)
        setChunkingMessage(answer)
        return prev
      })
    })

    const offDone = aiAgent.on.done(({ answer }) => {
      setIsChunking(false)
      setIsLoading(false)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Assistant: ${answer}`, isError: false },
      ])
      setChunkingMessage('')
    })

    const offError = aiAgent.on.error(({ error }) => {
      setIsChunking(false)
      setIsLoading(false)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Assistant: ${error}`, isError: true },
      ])
      setChunkingMessage('')
    })

    const cleanup = () => {
      offChunk()
      offDone()
      offError()
    }

    return cleanup
  }, [])

  /**
   * 初期化完了後に履歴を取得して設定
   */
  React.useEffect(() => {
    if (!initialized) return

    aiAgent.getHistory().then((history) => {
      // 既にメッセージがある場合は履歴を設定しない
      if (messages.length > 0) return
      setMessages((prev) => [...prev, ...history])
    })
  }, [initialized, messages.length])

  return { send, isChunking, isLoading, messages, chunkingMessage }
}

function RouteComponent() {
  const id = React.useId()
  const { send, isChunking, isLoading, messages, chunkingMessage } =
    useAiAgent()

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      // @ts-expect-error
      const input = e.currentTarget.elements[id] as HTMLInputElement

      const message = input.value
      input.value = '' // inputの文字をクリア

      send(message)
    },
    [id, send],
  )

  return (
    <div className="h-full w-full bg-primary/20 text-foreground overflow-hidden">
      <div className="h-full w-full overflow-hidden flex flex-col max-w-7xl mx-auto">
        <header className="bg-primary text-primary-foreground h-14 text-2xl font-bold flex items-center justify-center">
          AIアシスタント
        </header>
        <main className="p-2 flex-1 overflow-auto bg-background text-foreground">
          <div className="flex flex-col gap-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`p-2 rounded-md border ${
                  msg.role === 'user'
                    ? 'bg-blue-400 self-end'
                    : 'bg-accent text-foreground self-start'
                } ${msg.isError ? 'text-red-500' : 'text-black'}`}
              >
                <p className="font-bold">
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </p>
                <Message>{msg.content}</Message>
              </div>
            ))}
            {isLoading && !isChunking ? (
              <div className="p-2 rounded-md border bg-accent text-foreground self-start">
                <p className="font-bold">Assistant</p>
                <p className="animate-caret-blink">...</p>
              </div>
            ) : isChunking ? (
              <div className="p-2 rounded-md border bg-accent text-foreground self-start">
                <p className="font-bold">Assistant</p>
                <Message>{chunkingMessage}</Message>
              </div>
            ) : null}
          </div>
        </main>
        <form
          className="border-t border-primary flex gap-2 p-2 bg-background text-foreground"
          onSubmit={handleSubmit}
        >
          <Input
            type="text"
            name={id}
            id={id}
            className="flex-1 bg-background text-foreground"
            autoComplete="off"
            placeholder="メッセージを入力..."
          />
          <Button type="submit" className="cursor-pointer" disabled={isLoading}>
            {isLoading ? '送信中...' : '送信'}
          </Button>
        </form>
      </div>
    </div>
  )
}

function Message(props: { children: string }) {
  return <ReactMarkdown>{props.children}</ReactMarkdown>
}
