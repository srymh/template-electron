import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toolDefinition } from '@tanstack/ai'
import type * as TanStackAi from '@tanstack/ai'
import type { StreamChunk, TextOptions, Tool, UIMessage } from '@tanstack/ai'
import { uiMessagesToWire } from '@tanstack/ai/client'
import type { FakeResponse } from '@tanstack/ai/testing'
import { z } from 'zod'

import type { ChatRequest, ChatResponse } from '@repo/ai/chat'
import { getAiChatApi } from '@your-app-name/api/ai-chat'
import type { AiChatContext } from '@your-app-name/api/ai-chat'

import type { AppRuntime } from '../../app/app-runtime'
import type { WindowHost } from '../../app/feature'
import { createAiChatFeature } from './feature'

type FakeChatStreamOptions = {
  messages: Array<{ role: string; content?: unknown }>
  tools?: Array<{ name: string }>
  systemPrompts?: unknown[]
}

const fakes = vi.hoisted(() => ({
  chatStream: vi.fn<(options: FakeChatStreamOptions) => FakeResponse>(),
  ingestDocuments: vi.fn(),
  retrieveRagContext: vi.fn(),
}))

// 公式 fake adapter でモデル応答だけを制御し、chat エンジンを実行する。
vi.mock('@tanstack/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackAi>()
  const { fakeText } = await import('@tanstack/ai/testing')
  return {
    ...actual,
    chat: (options: Parameters<typeof actual.chat>[0]) => {
      const adapter = fakeText()
      adapter.setResponses(
        Array.from(
          { length: 10 },
          () =>
            ({ request }: { request: TextOptions }) =>
              fakes.chatStream(request),
        ),
      )
      return actual.chat({ ...options, adapter })
    },
  }
})

vi.mock('electron', () => ({ nativeTheme: { themeSource: 'system' } }))

vi.mock('@repo/ai/ollama/rag', () => ({
  ingestDocuments: fakes.ingestDocuments,
  retrieveRagContext: fakes.retrieveRagContext,
}))

/**
 * モデルのツール呼び出しを公式 fake adapter の応答として定義する。
 * @param toolCallId - 呼び出しを識別する ID
 * @param toolName - モデルが呼ぶツール名
 * @param input - モデルが指定する引数
 * @returns ツール呼び出しを含むモデル応答
 */
function toolCallTurn(toolCallId: string, toolName: string, input: unknown): FakeResponse {
  return { toolCalls: [{ id: toolCallId, name: toolName, input }] }
}

/**
 * 文章だけを返すモデル応答を定義する。
 * @param text - モデルが返す本文
 * @returns ツール呼び出しを含まないモデル応答
 */
function textTurn(text: string): FakeResponse {
  return { text }
}

/** API の検証用に、セッションを自身の中に保持する context を作る。 */
function createFakeContext(overrides: Partial<AiChatContext> = {}): AiChatContext {
  let session: ReturnType<AiChatContext['getAiChatSession']> = null
  return {
    getAiChatSession: () => session,
    setAiChatSession: (next) => {
      session = next
    },
    createTools: () => [],
    getSystemPrompts: () => [],
    ingestDocument: async () => {},
    ...overrides,
  }
}

const userMessages: UIMessage[] = [
  { id: 'user-1', role: 'user', parts: [{ type: 'text', content: 'こんにちは' }] },
]

/**
 * 標準の wire 変換を使い、UI 履歴から AG-UI 要求を作る。
 * @param messages - 送信する履歴。省略時は最初のユーザーメッセージ
 * @param id - 配送と実行を識別する ID。省略時は request
 * @returns 配送 ID を付けた標準 AG-UI 要求
 */
function createRequest(messages: UIMessage[] = userMessages, id = 'request') {
  return {
    messages: uiMessagesToWire(messages),
    threadId: 'thread',
    runId: id,
    tools: [],
    context: [],
    forwardedProps: {},
    state: null,
    id,
  } satisfies ChatRequest & { id: string }
}

/** 応答を購読して要求を実行し、完了またはエラーまでの応答を返す。 */
async function runChat<TKey>(
  api: ReturnType<typeof getAiChatApi<TKey>>,
  key: TKey,
  messages: UIMessage[] = userMessages,
) {
  const responses: ChatResponse[] = []
  const dispose = api.on.chunk(key)((response) => responses.push(response))
  await api.chat(key)(createRequest(messages))
  await vi.waitFor(() => {
    expect(responses.at(-1)?.type).toMatch(/^(done|error)$/)
  })
  dispose()
  return {
    responses,
    chunks: responses.flatMap((response) => (response.type === 'chunk' ? [response.chunk] : [])),
  }
}

/**
 * RUN_FINISHED が公開した標準 Interrupt を取り出す。
 * @param chunks - 受信したストリームイベント
 * @returns 停止した実行が公開した Interrupt の一覧
 */
function findInterrupts(chunks: StreamChunk[]) {
  return chunks.flatMap((chunk) =>
    chunk.type === 'RUN_FINISHED' && chunk.outcome?.type === 'interrupt'
      ? chunk.outcome.interrupts
      : [],
  )
}

/** 各要求でモデルへ広告されたツール名を返す。 */
function advertisedToolNames() {
  return fakes.chatStream.mock.calls.map(([options]) =>
    (options.tools ?? []).map((tool) => tool.name),
  )
}

const greetToolDef = toolDefinition({
  name: 'fixture_greet',
  description: 'テスト用の server ツール',
  inputSchema: z.object({ target: z.string() }),
  outputSchema: z.object({ message: z.string() }),
})

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('テスト中の外部通信は禁止'))),
  )
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  fakes.chatStream.mockReset()
  fakes.chatStream.mockImplementation(() => textTurn('完了'))
  fakes.ingestDocuments.mockReset()
  fakes.ingestDocuments.mockResolvedValue({ documentId: 'document', docName: 'name' })
  fakes.retrieveRagContext.mockReset()
  fakes.retrieveRagContext.mockResolvedValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('getAiChatApi に注入したツール構成', () => {
  it('能力を注入した独自 server ツールを実行し、結果をモデルへ返す', async () => {
    // Arrange
    const getPrefix = vi.fn(() => 'こんにちは')
    const greetTool = greetToolDef.server(async ({ target }) => ({
      message: `${getPrefix()}、${target}`,
    }))
    fakes.chatStream.mockImplementationOnce(() =>
      toolCallTurn('call-1', 'fixture_greet', { target: 'ピカチュウ' }),
    )
    const context = createFakeContext({ createTools: () => [greetTool] })
    const api = getAiChatApi(() => context)

    // Act
    const { responses } = await runChat(api, 'window')

    // Assert
    expect(responses.at(-1)?.type).toBe('done')
    expect(advertisedToolNames()).toEqual([['fixture_greet'], ['fixture_greet']])
    const toolMessage = fakes.chatStream.mock.calls[1]?.[0].messages.find(
      (message) => message.role === 'tool',
    )
    expect(toolMessage?.content).toContain('こんにちは、ピカチュウ')
  })

  it('非同期の factory が解決したツールをモデルへ渡す', async () => {
    // Arrange
    const greetTool = greetToolDef.server(async () => ({ message: 'ok' }))
    const context = createFakeContext({ createTools: () => Promise.resolve([greetTool]) })
    const api = getAiChatApi(() => context)

    // Act
    await runChat(api, 'window')

    // Assert
    expect(advertisedToolNames()).toEqual([['fixture_greet']])
  })

  it('空のツール一覧でも要求を完了する', async () => {
    // Arrange
    const context = createFakeContext({ createTools: () => [] })
    const api = getAiChatApi(() => context)

    // Act
    const { responses } = await runChat(api, 'window')

    // Assert
    expect(advertisedToolNames()).toEqual([[]])
    expect(responses.at(-1)?.type).toBe('done')
  })

  it('注入したプロンプトを要求ごとに評価してモデルへ渡す', async () => {
    // Arrange
    const getSystemPrompts = vi
      .fn<AiChatContext['getSystemPrompts']>()
      .mockReturnValueOnce(['最初の方針'])
      .mockReturnValueOnce(['次の方針'])
    const context = createFakeContext({ getSystemPrompts })
    const api = getAiChatApi(() => context)

    // Act
    await runChat(api, 'window')
    await runChat(api, 'window')

    // Assert
    expect(fakes.chatStream.mock.calls.map(([options]) => options.systemPrompts)).toEqual([
      ['最初の方針'],
      ['次の方針'],
    ])
  })

  it('ツールを要求ごとに生成し、window ごとの構成を混ぜない', async () => {
    // Arrange
    const createWindowATools = vi.fn<AiChatContext['createTools']>(() => [
      greetToolDef.server(async () => ({ message: 'a' })),
    ])
    const createWindowBTools = vi.fn<AiChatContext['createTools']>(() => [])
    const contexts = {
      a: createFakeContext({ createTools: createWindowATools }),
      b: createFakeContext({ createTools: createWindowBTools }),
    }
    const api = getAiChatApi((key: 'a' | 'b') => contexts[key])

    // Act
    await runChat(api, 'a')
    await runChat(api, 'b')
    await runChat(api, 'a')

    // Assert
    expect(createWindowATools).toHaveBeenCalledTimes(2)
    expect(createWindowBTools).toHaveBeenCalledTimes(1)
    expect(advertisedToolNames()).toEqual([['fixture_greet'], [], ['fixture_greet']])
  })

  it('client ツールの定義を広告し、実行は renderer へ依頼する', async () => {
    // Arrange
    const clientToolDef = toolDefinition({
      name: 'fixture_client',
      description: 'テスト用の client ツール',
      inputSchema: z.object({ value: z.string() }),
    })
    fakes.chatStream.mockImplementationOnce(() =>
      toolCallTurn('call-1', 'fixture_client', { value: 'x' }),
    )
    const context = createFakeContext({ createTools: () => [clientToolDef] })
    const api = getAiChatApi(() => context)

    // Act
    const { chunks } = await runChat(api, 'window')

    // Assert
    expect(advertisedToolNames()).toEqual([['fixture_client']])
    expect(findInterrupts(chunks)).toEqual([
      expect.objectContaining({
        toolCallId: 'call-1',
        metadata: expect.objectContaining({
          'tanstack:interruptBinding': expect.objectContaining({ kind: 'client-tool-execution' }),
        }),
      }),
    ])
  })

  it.each<[string, Partial<AiChatContext>]>([
    [
      'ツール factory の reject',
      { createTools: () => Promise.reject(new Error('構成に失敗しました')) },
    ],
    [
      'プロンプト取得の throw',
      {
        getSystemPrompts: () => {
          throw new Error('構成に失敗しました')
        },
      },
    ],
  ])('%s を error イベントとセッション完了へ接続する', async (_label, overrides) => {
    // Arrange
    const context = createFakeContext(overrides)
    const api = getAiChatApi(() => context)
    const responses: ChatResponse[] = []
    const dispose = api.on.chunk('window')((response) => responses.push(response))

    // Act
    await api.chat('window')(createRequest())

    // Assert: 購読を解除するとセッションが消えるため、解除前に完了を確認する
    await vi.waitFor(() => {
      expect(responses).toEqual([{ type: 'error', id: 'request', error: '構成に失敗しました' }])
    })
    expect(fakes.chatStream).not.toHaveBeenCalled()
    expect(context.getAiChatSession()?.phase).toBe('completed')
    dispose()
  })

  it('文書の取り込みを注入した能力へ委譲し、失敗をそのまま返す', async () => {
    // Arrange
    const ingestDocument = vi
      .fn<AiChatContext['ingestDocument']>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('取り込み失敗'))
    const context = createFakeContext({ ingestDocument })
    const api = getAiChatApi(() => context)

    // Act
    await api.ingestDocument('window')('本文')
    const failure = api.ingestDocument('window')('本文2')

    // Assert
    await expect(failure).rejects.toThrow('取り込み失敗')
    expect(ingestDocument.mock.calls).toEqual([['本文'], ['本文2']])
  })
})

describe('createAiChatFeature', () => {
  const electronDataPath = path.join('root', 'electron')
  const ragDbPath = path.join(electronDataPath, 'sample-rag.db')

  const windowHost = {} as WindowHost

  /**
   * desktop の構成に必要な能力だけを持つ機能を作る。
   * @param retrieveSecret - ツール実行時に secret を取得する能力
   * @param warn - secret の取得失敗を記録する能力
   * @returns 一時保存先を使うチャット機能
   */
  function createFeature(retrieveSecret: () => Promise<string>, warn: () => void) {
    return createAiChatFeature({
      appRuntime: {
        paths: { electronDataPath },
        secretStorage: { retrieveSecret },
        logger: { warn },
      } as unknown as AppRuntime,
    })
  }

  /** desktop の構成に必要な能力だけを持つ context を作る。 */
  function setup(retrieveSecret = vi.fn(async () => 'secret')) {
    const warn = vi.fn()
    const context = createFeature(retrieveSecret, warn).createWindowContext(windowHost)
    return { context, retrieveSecret, warn }
  }

  /** 構成済みのツールを名前で取り出す。 */
  async function getTool(context: AiChatContext, name: string): Promise<Tool> {
    const tools = (await context.createTools()) as NonNullable<TextOptions['tools']>
    const tool = tools.find((candidate) => candidate.name === name)
    if (!tool) {
      throw new Error(`ツールがありません: ${name}`)
    }
    return tool
  }

  it('既存の6ツールを名前の重複なく、同じ承認設定と実行環境で構成する', async () => {
    // Arrange
    const { context } = setup()

    // Act
    const tools = (await context.createTools()) as NonNullable<TextOptions['tools']>

    // Assert
    expect(
      tools.map((tool) => ({
        name: tool.name,
        needsApproval: tool.needsApproval ?? false,
        executesOnServer: tool.execute !== undefined,
      })),
    ).toEqual([
      { name: 'switch_theme_dark', needsApproval: false, executesOnServer: true },
      { name: 'switch_theme_light', needsApproval: false, executesOnServer: true },
      { name: 'clock', needsApproval: false, executesOnServer: false },
      { name: 'webSearch', needsApproval: true, executesOnServer: true },
      { name: 'addKnowledge', needsApproval: true, executesOnServer: true },
      { name: 'searchKnowledge', needsApproval: false, executesOnServer: true },
    ])
    expect(new Set(tools.map((tool) => tool.name)).size).toBe(tools.length)
  })

  it('プロンプトで利用を指示するツールは構成に含まれている', async () => {
    // Arrange
    const { context } = setup()
    const tools = (await context.createTools()) as NonNullable<TextOptions['tools']>

    // Act
    const mentionedNames = context
      .getSystemPrompts()
      .flatMap((prompt) => [...prompt.matchAll(/`([^`]+)`/g)].map((match) => match[1]))

    // Assert
    expect(mentionedNames).toContain('searchKnowledge')
    expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(mentionedNames))
  })

  it('API key はツールの生成時に取得せず、Web 検索の実行時に取得する', async () => {
    // Arrange: 空の key で止まるため外部通信は発生しない
    const retrieveSecret = vi.fn(async () => '')
    const { context } = setup(retrieveSecret)

    // Act
    const webSearch = await getTool(context, 'webSearch')
    const callsAfterCreate = retrieveSecret.mock.calls.length
    const execution = webSearch.execute?.({ query: 'ピカチュウ' })

    // Assert
    await expect(execution).rejects.toThrow('OLLAMA_API_KEY is not set')
    expect(callsAfterCreate).toBe(0)
    expect(retrieveSecret.mock.calls).toEqual([['OLLAMA_API_KEY']])
  })

  it('secret の取得に失敗したら警告して未設定として扱う', async () => {
    // Arrange
    const { context, warn } = setup(vi.fn(() => Promise.reject(new Error('not found'))))
    const webSearch = await getTool(context, 'webSearch')

    // Act
    const execution = webSearch.execute?.({ query: 'ピカチュウ' })

    // Assert
    await expect(execution).rejects.toThrow('OLLAMA_API_KEY is not set')
    expect(warn).toHaveBeenCalledWith('OLLAMA_API_KEY is not set in secret storage')
  })

  it('知識の保存・検索と文書の取り込みに同じ RAG DB パスを渡す', async () => {
    // Arrange
    const { context } = setup()

    // Act
    await (await getTool(context, 'addKnowledge')).execute?.({ content: 'ツールの本文' })
    await (await getTool(context, 'searchKnowledge')).execute?.({ query: '検索語' })
    await context.ingestDocument('文書の本文')

    // Assert
    expect(fakes.ingestDocuments.mock.calls).toEqual([
      ['ツールの本文', expect.objectContaining({ dbPath: ragDbPath })],
      ['文書の本文', expect.objectContaining({ dbPath: ragDbPath })],
    ])
    expect(fakes.retrieveRagContext.mock.calls).toEqual([
      ['検索語', expect.objectContaining({ dbPath: ragDbPath })],
    ])
  })

  it('文書の保存失敗を従来どおり reject にしない', async () => {
    // Arrange
    fakes.ingestDocuments.mockRejectedValueOnce(new Error('保存失敗'))
    const { context } = setup()

    // Act
    const result = context.ingestDocument('本文')

    // Assert
    await expect(result).resolves.toBeUndefined()
  })

  describe('window ごとのセッション', () => {
    /** 同じ機能から二つの window の context を作り、API へ接続する。 */
    function setupWindows() {
      const feature = createFeature(vi.fn(), vi.fn())
      const contexts = {
        a: feature.createWindowContext(windowHost),
        b: feature.createWindowContext(windowHost),
      }
      return { contexts, api: getAiChatApi((key: 'a' | 'b') => contexts[key]) }
    }

    /** 指定 window の応答を購読し、受け取った応答と解除処理を返す。 */
    function subscribe(api: ReturnType<typeof setupWindows>['api'], key: 'a' | 'b') {
      const responses: ChatResponse[] = []
      const dispose = api.on.chunk(key)((response) => responses.push(response))
      return { responses, dispose }
    }

    it('二つの window を交互に操作しても応答とセッションを混ぜない', async () => {
      // Arrange
      const { api } = setupWindows()
      const windowA = subscribe(api, 'a')
      const windowB = subscribe(api, 'b')

      // Act
      await api.chat('a')(createRequest(userMessages, 'request-a'))
      await vi.waitFor(() => expect(windowA.responses.at(-1)?.type).toBe('done'))
      await api.chat('b')(createRequest(userMessages, 'request-b'))
      await vi.waitFor(() => expect(windowB.responses.at(-1)?.type).toBe('done'))
      windowA.dispose()
      windowB.dispose()

      // Assert
      expect(new Set(windowA.responses.map(({ id }) => id))).toEqual(new Set(['request-a']))
      expect(new Set(windowB.responses.map(({ id }) => id))).toEqual(new Set(['request-b']))
    })

    it('実行後に購読しても応答を受け取り、他の window のセッションは作らない', async () => {
      // Arrange
      const { api, contexts } = setupWindows()

      // Act
      await api.chat('a')(createRequest(userMessages, 'request-a'))
      const windowA = subscribe(api, 'a')
      await vi.waitFor(() => expect(windowA.responses.at(-1)?.type).toBe('done'))
      const sessionOfOtherWindow = contexts.b.getAiChatSession()
      windowA.dispose()

      // Assert
      expect(windowA.responses.at(-1)).toEqual({ type: 'done', id: 'request-a' })
      expect(sessionOfOtherWindow).toBeNull()
    })
  })

  describe('承認が必要なツール', () => {
    /** desktop の構成を API へ接続する。 */
    function setupApi() {
      const { context } = setup()
      return getAiChatApi(() => context)
    }

    it('承認前は実行せず、承認を要求する', async () => {
      // Arrange
      fakes.chatStream.mockImplementationOnce(() =>
        toolCallTurn('call-1', 'addKnowledge', { content: '保存する本文' }),
      )

      // Act
      const { chunks } = await runChat(setupApi(), 'window')

      // Assert
      expect(findInterrupts(chunks)).toEqual([
        expect.objectContaining({
          toolCallId: 'call-1',
          metadata: expect.objectContaining({
            'tanstack:interruptBinding': expect.objectContaining({ kind: 'tool-approval' }),
          }),
        }),
      ])
      expect(fakes.ingestDocuments).not.toHaveBeenCalled()
    })

    // 承認・拒否後の再開は web の chat-client-tools.test.ts で
    // useChat → IPC adapter → API → chat の往復を通して検証する。
  })
})
