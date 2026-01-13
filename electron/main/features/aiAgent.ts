import crypto from 'node:crypto'

import { createResponseChannel } from '../lib/ipc'
import { AiAgent } from '../services/ai-agent/AiAgent'

import type { WebContents } from 'electron'
import type {
  ApiInterface,
  AddListener,
  WithWebContents,
  WithWebContentsApi,
} from '../lib/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const AI_AGENT_API_KEY = 'aiAgent' as const
export type AiAgentApiKey = typeof AI_AGENT_API_KEY

export type AiAgentContext = {
  getAiAgent: () => AiAgent | null
  setAiAgent: (agent: AiAgent | null) => void
}

export type SetupOptions = {
  /** 初期指示文（オプション） */
  instructions?: string
  /** 使用するモデル名 例: "qwen3:1.7b" */
  modelName: string
  /** AI サーバーのベース URL 例: http://localhost:11434/v1 */
  baseUrl: string
  /** API キー（必要な場合） */
  apiKey?: string
  /** モデルの温度設定（オプション） */
  temperature?: number
  /** MCPサーバーのURLリスト */
  mcpServerUrlList?: string[]
}

// -----------------------------------------------------------------------------
// インターフェイス定義

export type AiAgentApi = ApiInterface<{
  /**
   * AI エージェントをセットアップします。
   * @param options セットアップオプション
   * @returns 成功した場合は `{ ok: true }` を返します。
   */
  setup: (options: SetupOptions) => Promise<{ ok: boolean }>

  /**
   * メッセージを AI エージェントに送信します。
   * @param options.message ユーザーメッセージ
   * @returns メッセージ ID と成功フラグを含むオブジェクト
   */
  send: (options: { message: string }) => Promise<{ id: string; ok: boolean }>

  /**
   * AI エージェントのメッセリー履歴を取得します。
   * @returns メッセージ履歴の配列
   */
  getHistory: () => Promise<{ role: 'user' | 'assistant'; content: string }[]>

  on: {
    /**
     * メッセージの一部がチャンクとして受信されたときに発火します。
     */
    chunk: AddListener<{ id: string; chunk: string; answer: string }>

    /**
     * メッセージの受信が完了したときに発火します。
     */
    done: AddListener<{ id: string; answer: string }>

    /**
     * メッセージの受信中にエラーが発生したときに発火します。
     */
    error: AddListener<{ id: string; error: string }>
  }
}>

// -----------------------------------------------------------------------------
// 実装

const setupFn =
  (
    getContext: (webContents: WebContents) => AiAgentContext,
  ): WithWebContents<AiAgentApi['setup']> =>
  async (options, webContents) => {
    const { getAiAgent, setAiAgent } = getContext(webContents)

    const {
      instructions = '',
      modelName,
      baseUrl,
      apiKey = '',
      temperature = 0,
      mcpServerUrlList = [],
    } = options

    const aiAgent = getAiAgent()
    if (aiAgent) {
      // 既に初期化されている場合は何もしない
      console.log('AI agent is already initialized.')
      return { ok: true }
    }

    try {
      const agent = await AiAgent.createAiAgent({
        name: 'ElectronAiAgent',
        instructions,
        ai: { baseUrl, apiKey, modelName },
        mcpServers: [...mcpServerUrlList.map((url) => ({ url }))],
        others: {
          modelSettings: {
            temperature,
          },
        },
      })

      setAiAgent(agent)
    } catch (error) {
      throw new Error(`Failed to create AiAgent: ${error}`)
    }

    return { ok: true }
  }

const sendFn =
  (
    getContext: (webContents: WebContents) => AiAgentContext,
  ): WithWebContents<AiAgentApi['send']> =>
  async ({ message }, webContents) => {
    const { getAiAgent } = getContext(webContents)

    const aiAgent = getAiAgent()
    if (!aiAgent) {
      throw new Error('AI agent is not initialized')
    }

    const id = crypto.randomUUID()

    try {
      await aiAgent.streamReplyWithHandlers(message, {
        onChunk: ({ chunk, answer }) => {
          webContents.send(createResponseChannel('aiAgent.on.chunk'), {
            id,
            chunk,
            answer,
          })
        },
        onDone: ({ answer }) => {
          webContents.send(createResponseChannel('aiAgent.on.done'), {
            id,
            answer,
          })
        },
        onError: (error) => {
          webContents.send(createResponseChannel('aiAgent.on.error'), {
            id,
            error: error.message,
          })
        },
      })
    } catch (error) {
      // 念のためここでもフォールバック送信
      webContents.send(createResponseChannel('aiAgent.on.error'), {
        id,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return { ok: true, id }
  }

const getHistoryFn =
  (
    getContext: (webContents: WebContents) => AiAgentContext,
  ): WithWebContents<AiAgentApi['getHistory']> =>
  async (webContents) => {
    const { getAiAgent } = getContext(webContents)

    const aiAgent = getAiAgent()
    if (!aiAgent) {
      throw new Error('AI agent is not initialized')
    }

    const history = aiAgent.getHistory()
    return history
  }

export function getAiAgentApi(
  getContext: (webContents: WebContents) => AiAgentContext,
): WithWebContentsApi<AiAgentApi> {
  return {
    setup: setupFn(getContext),
    send: sendFn(getContext),
    getHistory: getHistoryFn(getContext),
    on: {
      chunk: () => () => {},
      done: () => () => {},
      error: () => () => {},
    },
  }
}
