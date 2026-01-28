/**
 * https://github.com/openai/openai-agents-js/blob/6aff4c4e286fc3983595984512ccc716dcb4286b/examples/basic/hello-world-gpt-oss.ts
 *
 * これは、Ollamaでgpt-ossを使用する例です。
 * 詳細は https://cookbook.openai.com/articles/gpt-oss/run-locally-ollama を参照してください。
 * LM Studioを使用したい場合は、https://cookbook.openai.com/articles/gpt-oss/run-locally-lmstudio を参照してください。
 */

import {
  Agent,
  type AgentConfiguration,
  OpenAIChatCompletionsModel,
  run,
  setTracingDisabled,
} from '@openai/agents'
import { MCPServerStreamableHttp } from '@openai/agents-core/_shims'
import { OpenAI } from 'openai'

type Turn = { role: 'user' | 'assistant'; content: string }

export type AiAgentOptions = {
  /** エージェントの名前 */
  name?: string
  /**
   * @author GitHub Copilot
   * エージェント用の指示。
   * エージェントが呼び出される際の「system prompt」として使われ、エージェントが何を
   * 行いどのように応答するかを記述する。
   */
  instructions?: string
  /**
   * その他のオプション
   * Agentコンストラクタに渡されるが、ここで明示的に型定義されていないもの
   */
  others?: Omit<
    Partial<AgentConfiguration>,
    'name' | 'model' | 'instructions' | 'mcpServers'
  >
  /** openai互換サーバーの設定 */
  ai: {
    /** openai互換サーバーのURL */
    baseUrl: string
    /** openai互換サーバーのAPIキー */
    apiKey: string
    /** モデル名 */
    modelName: string
  }
  /** MCPサーバーの設定 */
  mcpServers?: (
    | {
        /** HTTPトランスポートのURL */
        url: string
      }
    | {
        /** stdioトランスポートのコマンドの名前 */
        command: 'node' | string
        /** コマンドの引数 */
        args: string[]
      }
  )[]
}

/**
 * @author GitHub Copilot
 * `setTracingDisabled(true);` は @openai/agents ランタイムの内部トレーシング
 * （実行ステップの計測・イベント送出・デバッグ用メタデータ収集）を無効化しています。
 * これを呼ぶと以下のようなことが止まります（実装依存ですが概ね）:
 * - 各ステップ/ツール呼び出しの span 生成やタイムライン記録
 * - 追加のデバッグ用イベント／メタ情報送信
 * - 開発用の詳細ログ（必要最小限のみ残る）
 *
 * 結果: 若干オーバーヘッドや冗長ログを減らし、外部へ送られる計測データ（もし有効なら）
 * を抑制します。取り除く or false にすると、エージェントのステップやチェーンをデバッグ
 * しやすくなる代わりに、ログ/計測が増えます。
 */
setTracingDisabled(true)

export class AiAgent implements Disposable {
  private static readonly MAX_TURNS = 20

  private name: string = 'AiAgent'
  private instructions: string = ''
  private otherOptions: AiAgentOptions['others'] = {}
  private agent: Agent | null = null
  private ai: OpenAI
  private modelName: string
  private mcpServers: MCPServerStreamableHttp[] = []
  private history: Turn[] = []

  static async createAiAgent(options: AiAgentOptions) {
    const agent = new AiAgent(options)
    await agent.initialize()
    return agent
  }

  /**
   * エージェントの初期化
   */
  constructor(options: AiAgentOptions) {
    const { name, instructions, others, ai, mcpServers } = options

    this.name = name ?? this.name
    this.instructions = instructions ?? this.instructions
    this.otherOptions = others ?? this.otherOptions
    // @ts-expect-error
    delete this.otherOptions.name // 念のため
    // @ts-expect-error
    delete this.otherOptions.model // 念のため
    // @ts-expect-error
    delete this.otherOptions.instructions // 念のため
    // @ts-expect-error
    delete this.otherOptions.mcpServers // 念のため

    this.ai = new OpenAI({
      baseURL: ai.baseUrl,
      apiKey: ai.apiKey,
    })

    this.modelName = options.ai.modelName

    if (mcpServers && mcpServers.length > 0) {
      for (const serverConfig of mcpServers) {
        if ('url' in serverConfig) {
          this.mcpServers.push(
            new MCPServerStreamableHttp({
              url: serverConfig.url,
            }),
          )
        } else {
          throw new Error('The stdio transport is not supported.')
        }
      }
    }
  }

  [Symbol.dispose](): void {
    throw new Error('Method not implemented.')
  }

  /**
   * エージェントの初期化
   */
  async initialize() {
    await this.connectMcpServer()

    /**
     * エージェントでカスタムの outputType を使用すると、gpt-oss モデルではうまく動作しない場合があります。
     * デフォルトの "text" outputType を使用することを推奨します。
     * 詳細は https://github.com/openai/openai-agents-python/issues/1414 を参照してください。
     */
    this.agent = new Agent({
      name: this.name,
      model: new OpenAIChatCompletionsModel(this.ai, this.modelName),
      mcpServers: this.mcpServers,
      instructions: this.instructions,
      ...this.otherOptions,
    })
  }

  /**
   * 会話履歴全体を元にアシスタントの返答をストリーミングする AsyncGenerator。
   * 各 yield で {chunk, answer} を返し、最終的な return 値は最終回答文字列。
   * @param userMessage ユーザーのメッセージ
   */
  async *streamReply(
    userMessage: string,
  ): AsyncGenerator<{ chunk: string; answer: string }, string> {
    if (!this.agent) {
      throw new Error('Agent is not initialized.')
    }

    this.history.push({ role: 'user', content: userMessage })
    this.trimHistory()

    // 履歴をテキストに整形
    const lines: string[] = []
    for (const h of this.history) {
      const prefix = h.role === 'user' ? 'User' : 'Assistant'
      lines.push(`${prefix}: ${h.content}`)
    }

    /**
     * @author GitHub Copilot
     * 現状はステートレス API で会話文脈を維持するため全履歴を逐次再送している設計。
     * 必要に応じ要約・フォーマット改善・messages 利用へ拡張可。
     *
     * 主な理由:
     * 1. 会話コンテキスト保持: 過去のユーザー/アシスタント発話を毎ターン同じプロンプト
     *    に再埋め込みすることで、モデルが前後関係を参照できるようにしている。
     *    stateless API 呼び出しを擬似的に stateful 化。
     * 2. ラベル付け形式(User:/Assistant:)で簡易ロールを再構成している。messages API
     *    を直接使わず文字列連結している実装上の簡便法。
     * 3. Agent 内の instructions (システムメッセージ相当) + 今回組み立てた
     *    過去ログ= 最終入力、という構図。
     *
     * 副作用 / 課題:
     * - トークン増大で遅延・コスト増。
     * - ロール表現が簡素 (User / Assistant) なので曖昧さのリスク。
     * - モデルが直近ターンへの応答境界を誤解する可能性 (ファインチューニング想定フォー
     *   マットと違う場合)。
     * - 指示の「ドリフト」(古いユーザー要求が残留)。
     * - MAX_TURNS でトリミングしているが、切り方が固定長で要約なし。
     *
     * 改善案(例):
     * - messages 形式が使えるならそれを利用する。
     * - 直近以外を要約して圧縮。
     * - 明示的な区切りトークンを導入。
     * - システム/ユーザー/アシスタントの ChatML 風フォーマットを採用。
     * - キャッシュ(過去→埋め込み→要約)でトークン削減。
     */
    const prompt = lines.join('\n\n')
    const stream = await run(this.agent, prompt, { stream: true })

    let answer = ''
    for await (const chunk of stream.toTextStream()) {
      answer += chunk
      yield { chunk, answer }
    }

    answer = answer.trim()

    this.history.push({ role: 'assistant', content: answer })
    this.trimHistory()

    return answer
  }

  /**
   * ユーザー入力に対し、チャンク/完了/エラーをコールバックで通知します。
   * Electron 等の環境に依存しない薄いヘルパーです。
   */
  async streamReplyWithHandlers(
    message: string,
    handlers: {
      onChunk?: (payload: { chunk: string; answer: string }) => void
      onDone?: (payload: { answer: string }) => void
      onError?: (error: Error) => void
    },
  ): Promise<void> {
    try {
      let finalAnswer = ''

      for await (const { chunk, answer } of this.streamReply(message)) {
        finalAnswer = answer
        handlers.onChunk?.({ chunk, answer })
      }

      handlers.onDone?.({ answer: finalAnswer })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      handlers.onError?.(error)
    }
  }

  getHistory(): Turn[] {
    if (!this.agent) {
      throw new Error('Agent is not initialized.')
    }

    return this.history
  }

  // #region Private Methods

  private async connectMcpServer() {
    if (this.mcpServers.length === 0) {
      return
    }

    await Promise.all(this.mcpServers.map((server) => server.connect()))
  }

  private trimHistory() {
    if (this.history.length > AiAgent.MAX_TURNS) {
      const temp = this.history.slice(this.history.length - AiAgent.MAX_TURNS)
      if (this.history !== temp) {
        // this.history = temp とすると参照が変わってしまうので、spliceで中身を書き換える
        this.history.splice(0, this.history.length, ...temp)
      }
    }
  }

  // #endregion Private Methods
}
