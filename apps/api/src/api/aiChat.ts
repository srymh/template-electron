import type { ServerTool, StreamChunk } from '@tanstack/ai'

import { chat } from '@repo/ai-chat'
import type { ChatRequest, ChatResponse } from '@repo/ai-chat'
import {
  attachAiChatListener,
  clearAiChatSession,
  markAiChatSessionCompleted,
  markAiChatSessionRunning,
  prepareAiChatSessionForChat,
} from '@repo/ai-chat-session'
import type { AiChatSession } from '@repo/ai-chat-session'
import {
  createWebSearchTool,
  createAddKnowledgeTool,
  createSearchKnowledgeTool,
} from '@repo/ai-ollama-tools'
import { clockToolDef } from '@repo/ai-tools/client/definitions'
import { switchThemeDarkTool, switchThemeLightTool } from '@repo/ai-tools/server/tools'
import type { AddListener, ApiInterface, WithCallerKey, WithCallerKeyApi } from '@repo/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const AI_CHAT_API_KEY = 'aiChat' as const
export type AIChatApiKey = typeof AI_CHAT_API_KEY

export type AiChatContext = {
  getToolsByMcp: () => Promise<ServerTool[]>
  getAiChatSession: () => AiChatSession | null
  setAiChatSession: (session: AiChatSession | null) => void
  getApiKey: (provider: 'ollama') => Promise<string | undefined>
  getRagDbPath: () => string
}

// -----------------------------------------------------------------------------
// インターフェイス定義

export type AiChatApi = ApiInterface<{
  chat: (request: {
    messages: ChatRequest['messages']
    // data の内容に id が含まれているが、外部ライブラリ依存の挙動なのでここでは利用しない
    data: unknown
    id: string
  }) => Promise<void>
  ingestDocument: (text: string) => Promise<void>
  on: {
    chunk: AddListener<ChatResponse>
  }
}>

// -----------------------------------------------------------------------------
// 実装

/**
 * @note 以下の指示に確実に従うわけではないので注意。ミドルウェアで制御するのが望ましい。
 */
const SYSTEM_PROMPT = `あなたは、ユーザーの依頼に正確で役立つ形で応答するアシスタントです。

根拠のない推測を事実のように述べず、確認済みの情報と未確認の情報を分けて答えてください。

利用できる主なツール例:

- \`searchKnowledge\`: 保存済みの知識（外部知識）を検索します。あなたの内部知識にない言葉や概念がユーザーの発言の中に含まれる場合（特に固有名詞、人物名、プロジェクト名、専門用語など）には、自己判断で省略せず使用してください。
- \`webSearch\`: \`searchKnowledge\` の結果で不足している場合に、公開Web上の最新情報や外部情報を確認します。
- \`addKnowledge\`: ユーザーが保存を依頼した内容を、あとで検索できる外部知識として保存します。

\`webSearch\` を使う前に、 \`searchKnowledge\` を使用してください。

\`searchKnowledge\` の結果や内部知識で回答する際には、保存済み知識に基づくこと、最新の公開情報で裏取りできていないこと、不確かな点を明示してください。ユーザーが単に「知識」と言った場合は、保存済みの知識（外部知識）を指すことを意味します。ユーザーが明示的に内部知識を求める場合は、内部知識に基づくことを明示してください。

情報が不足している場合は、必要な確認質問をするか、利用可能なツールで確認してください。ツール結果が空または不十分な場合は、その事実を伝えてください。
`

const createChat =
  <TKey>(getContext: (key: TKey) => AiChatContext): WithCallerKey<AiChatApi['chat'], TKey> =>
  async (request, key) => {
    const { getToolsByMcp, getAiChatSession, setAiChatSession, getApiKey, getRagDbPath } =
      getContext(key)
    const { messages, data, id } = request

    const sessionStore = {
      getSession: getAiChatSession,
      setSession: setAiChatSession,
    }
    const session = prepareAiChatSessionForChat(sessionStore)
    markAiChatSessionRunning(session)

    let settled = false

    const sendChunk = (chunk: StreamChunk) => {
      session.queue.push({ type: 'chunk', id, chunk })
    }
    const sendDone = () => {
      if (settled) return
      settled = true
      session.queue.push({ type: 'done', id })
      markAiChatSessionCompleted(session)
      session.queue.close()
    }
    const sendError = (error: unknown) => {
      if (settled) return
      settled = true
      session.queue.push({
        type: 'error',
        id,
        error: error instanceof Error ? error.message : String(error),
      })
      markAiChatSessionCompleted(session)
      session.queue.close()
    }

    const createTools = async () => {
      const toolsByMcp = await getToolsByMcp()
      const webSearchTool = createWebSearchTool(() => getApiKey('ollama'))
      const addKnowledgeTool = createAddKnowledgeTool({ getDbPath: getRagDbPath })
      const searchKnowledgeTool = createSearchKnowledgeTool({ getDbPath: getRagDbPath })
      return [
        switchThemeDarkTool,
        switchThemeLightTool,
        clockToolDef,
        ...toolsByMcp,
        webSearchTool,
        addKnowledgeTool,
        searchKnowledgeTool,
      ]
    }

    try {
      await chat({
        request: { messages, data },
        onChunk: sendChunk,
        onDone: sendDone,
        onError: sendError,
        createTools,
        systemPrompts: [SYSTEM_PROMPT],
      })
    } catch (error) {
      console.error(`${new Date().toISOString()} Error in AiChatApi chat:`, error)
      sendError(error)
    }
  }

export function getAiChatApi<TKey>(
  getContext: (key: TKey) => AiChatContext,
): WithCallerKeyApi<AiChatApi, TKey> {
  return {
    chat: createChat(getContext),
    ingestDocument: async (text: string, key) => {
      const { getRagDbPath } = getContext(key)
      const addKnowledgeTool = createAddKnowledgeTool({ getDbPath: getRagDbPath })
      const addKnowledge = addKnowledgeTool.execute
      if (!addKnowledge) {
        throw new Error('Add knowledge tool is not available')
      }
      await addKnowledge({ content: text })
    },
    on: {
      chunk: (listener, key) => {
        const { getAiChatSession, setAiChatSession } = getContext(key)
        const sessionStore = {
          getSession: getAiChatSession,
          setSession: setAiChatSession,
        }
        const session = attachAiChatListener(sessionStore)

        ;(async () => {
          for (;;) {
            const resp = await session.queue.shift()
            if (resp == null) {
              break
            }
            listener(resp)
          }
        })().catch((error) => {
          console.error(`${new Date().toISOString()} Error in AiChatApi chunk listener:`, error)
        })

        let disposed = false
        return () => {
          if (disposed) return
          disposed = true
          clearAiChatSession(sessionStore, session)
        }
      },
    },
  }
}
