import { createElement } from 'react'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toolDefinition } from '@tanstack/ai'
import type * as TanStackAi from '@tanstack/ai'
import type { TextOptions } from '@tanstack/ai'
import { clientTools } from '@tanstack/ai-client'
import { useChat } from '@tanstack/ai-react'
import { fakeText } from '@tanstack/ai/testing'
import type { FakeResponse } from '@tanstack/ai/testing'
import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { z } from 'zod'

import { addKnowledgeToolDef } from '@repo/ai/ollama/tools/definitions'
import { aiChatAdapter } from '@repo/ai/react'
import type { ChatRequest } from '@repo/ai/shared'
import { clockToolDef } from '@repo/ai/tools/client/definitions'
import { getAiChatApi } from '@your-app-name/api/ai-chat'
import type { AiChatContext } from '@your-app-name/api/ai-chat'

import { ToolCallContent } from '@/features/chat/components/parts/tool-call-content'
import { createChatAttachmentMessagePart } from '@/features/chat/hooks/use-chat-attachment'
import { chatClientTools } from '@/features/chat/tools/chat-client-tools'
import { getCurrentPageTool } from '@/features/chat/tools/get-current-page'

const model = vi.hoisted(() => ({ getAdapter: vi.fn() }))

vi.mock('@tanstack/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackAi>()
  return {
    ...actual,
    chat: (options: Parameters<typeof actual.chat>[0]) =>
      actual.chat({ ...options, adapter: model.getAdapter() }),
  }
})

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('テスト中の外部通信は禁止'))),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * 本物の API・セッションを IPC 接続 adapter と結ぶ。
 * @param tools - 要求ごとにモデルへ渡すツール
 * @returns 接続と、実際に API へ届いた要求の記録
 */
function createConnection(tools: TextOptions['tools']) {
  let session: ReturnType<AiChatContext['getAiChatSession']> = null
  const context: AiChatContext = {
    getAiChatSession: () => session,
    setAiChatSession: (next) => {
      session = next
    },
    createTools: () => tools,
    getSystemPrompts: () => [],
    ingestDocument: async () => {},
  }
  const api = getAiChatApi(() => context)
  const requests: Array<ChatRequest> = []
  const connection = aiChatAdapter({
    chat: async (request) => {
      requests.push(request)
      await api.chat('window')(request)
    },
    addListener: api.on.chunk('window'),
  })
  return { connection, requests }
}

/**
 * モデル要求を記録し、用意した応答を公式 fake adapter から返す。
 * @param responses - モデルが順に返す応答
 * @returns 接続する fake adapter と、モデルへ届いた要求の記録
 */
function prepareModel(responses: FakeResponse[]) {
  const adapter = fakeText()
  const calls: TextOptions[] = []
  adapter.setResponses(
    responses.map((response) => ({ request }) => {
      calls.push(request)
      return response
    }),
  )
  model.getAdapter.mockReturnValue(adapter)
  return { adapter, calls }
}

describe('chatClientTools', () => {
  it('時計ツールを定義と同じ名前・schemaで実行可能な形で登録する', () => {
    // Act
    const [registeredClockTool] = chatClientTools

    // Assert
    expect(registeredClockTool.name).toBe(clockToolDef.name)
    expect(registeredClockTool.inputSchema).toBe(clockToolDef.inputSchema)
    expect(registeredClockTool.outputSchema).toBe(clockToolDef.outputSchema)
    expect(registeredClockTool.execute?.({})).toEqual({ time: expect.any(String) })
  })

  it('登録一覧に同名のツールがない', () => {
    // Act
    const toolNames = chatClientTools.map((tool) => tool.name)

    // Assert
    expect(new Set(toolNames).size).toBe(toolNames.length)
  })
})

describe('定義を共有する client ツール', () => {
  it('モデルの依頼を実装で実行し、結果を会話へ返す', async () => {
    // Arrange: main へ登録する定義と同じものから renderer の実装を作る
    const fixtureToolDef = toolDefinition({
      name: 'fixture_echo',
      description: 'テスト用の client ツール',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
    })
    const execute = vi.fn(({ value }: { value: string }) => ({ echoed: `${value}!` }))
    const { calls } = prepareModel([
      { toolCalls: [{ id: 'call-1', name: fixtureToolDef.name, input: { value: 'x' } }] },
      { text: '実行しました', thinking: '確認中' },
    ])
    const { connection, requests } = createConnection([fixtureToolDef])
    const tools = clientTools(fixtureToolDef.client(execute))
    const { result } = renderHook(() => useChat({ connection, tools, threadId: 'thread' }))

    // Act
    await act(async () => {
      await result.current.sendMessage('実行して')
    })

    // Assert: client 実行の結果と標準の resume が API を経由してモデルへ届く
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0]?.[0]).toEqual({ value: 'x' })
    expect(requests[1]).toMatchObject({
      threadId: 'thread',
      parentRunId: requests[0]?.runId,
      resume: [expect.objectContaining({ status: 'resolved' })],
    })
    expect(calls[1]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'tool', content: expect.stringContaining('x!') }),
      ]),
    )
    expect(result.current.messages.flatMap((message) => message.parts)).toContainEqual(
      expect.objectContaining({ type: 'text', content: '実行しました' }),
    )
    expect(result.current.messages.flatMap((message) => message.parts)).toContainEqual(
      expect.objectContaining({ type: 'thinking', content: '確認中' }),
    )
  })
})

describe('renderer から宣言する client ツール', () => {
  it('main に定義を登録せず、呼び出し時点の DOM 情報を取得してモデルへ返す', async () => {
    // Arrange: main 側の一覧は空にし、実際の renderer 登録一覧を送信する
    const originalTitle = document.title
    const originalUrl = window.location.href
    const { calls } = prepareModel([
      { toolCalls: [{ id: 'page-1', name: 'get_current_page', input: {} }] },
      { text: '現在はやること一覧を開いています' },
    ])
    const { connection, requests } = createConnection([])
    const { result } = renderHook(() =>
      useChat({ connection, tools: chatClientTools, threadId: 'page-thread' }),
    )

    try {
      // Act: ツールの作成後に変わった DOM と URL を取得する
      document.title = 'やること一覧'
      window.history.replaceState(null, '', '/index.html#/todo')
      await act(async () => {
        await result.current.sendMessage('今どの画面を開いている？')
      })
      await vi.waitFor(() => expect(requests).toHaveLength(2))

      // Assert: 定義宣言が main へ届き、モデルに提示されている
      expect(requests[0]?.tools).toContainEqual(
        expect.objectContaining({
          name: 'get_current_page',
          parameters: expect.objectContaining({ type: 'object' }),
        }),
      )
      expect(calls[0]?.tools).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'get_current_page' })]),
      )
      const toolMessage = calls[1]?.messages.find((message) => message.role === 'tool')
      if (typeof toolMessage?.content !== 'string') throw new Error('ツール結果がありません')
      expect(JSON.parse(toolMessage.content)).toEqual({
        title: 'やること一覧',
        pathname: '/index.html',
        hash: '#/todo',
      })
      expect(result.current.messages.flatMap((message) => message.parts)).toContainEqual(
        expect.objectContaining({ type: 'text', content: '現在はやること一覧を開いています' }),
      )
      expect(chatClientTools).toContain(getCurrentPageTool)
    } finally {
      document.title = originalTitle
      window.history.replaceState(null, '', originalUrl)
    }
  })

  it('同名の client 宣言があっても server の実装を使う', async () => {
    // Arrange
    const definition = toolDefinition({
      name: 'fixture_collision',
      description: '同名ツールの実行先を確認する',
      inputSchema: z.object({}),
      outputSchema: z.object({ side: z.string() }),
    })
    const serverExecute = vi.fn(async () => ({ side: 'server' }))
    const clientExecute = vi.fn(() => ({ side: 'client' }))
    const { calls } = prepareModel([
      { toolCalls: [{ id: 'collision-1', name: 'fixture_collision', input: {} }] },
      { text: '完了' },
    ])
    const { connection, requests } = createConnection([definition.server(serverExecute)])
    const { result } = renderHook(() =>
      useChat({
        connection,
        tools: clientTools(definition.client(clientExecute)),
        threadId: 'collision-thread',
      }),
    )

    // Act
    await act(async () => {
      await result.current.sendMessage('実行して')
    })

    // Assert
    expect(serverExecute).toHaveBeenCalledTimes(1)
    expect(clientExecute).not.toHaveBeenCalled()
    expect(requests).toHaveLength(1)
    expect(calls[0]?.tools?.map((tool) => tool.name)).toEqual(['fixture_collision'])
    expect(calls[1]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'tool', content: JSON.stringify({ side: 'server' }) }),
      ]),
    )
  })
})

describe('標準 Interrupt による server ツールの承認', () => {
  it.each([true, false])(
    '承認=%s の判断を IPC 経由で再開し、許可時だけ保存する',
    async (approved) => {
      // Arrange: UI と server で同じ定義を使い、副作用だけを spy にする
      const execute = vi.fn(async () => ({ success: true, message: '保存しました' }))
      const { calls } = prepareModel([
        { toolCalls: [{ id: 'save-1', name: 'addKnowledge', input: { content: '本文' } }] },
        { text: '完了' },
      ])
      const { connection, requests } = createConnection([addKnowledgeToolDef.server(execute)])
      const { result } = renderHook(() =>
        useChat({
          connection,
          tools: [addKnowledgeToolDef] as const,
          threadId: 'approval-thread',
          forwardedProps: { model: 'gpt-oss:120b-cloud' },
        }),
      )

      // Act: 最初の要求では停止し、まだ保存しない
      await act(async () => {
        await result.current.sendMessage('保存して')
      })
      const interrupt = result.current.interrupts.find((item) => item.kind === 'tool-approval')

      // Assert
      expect(interrupt).toMatchObject({ toolCallId: 'save-1', originalArgs: { content: '本文' } })
      expect(execute).not.toHaveBeenCalled()

      // Act: 標準の bound interrupt へ判断を返す
      if (!interrupt || interrupt.kind !== 'tool-approval') throw new Error('承認要求がありません')
      const toolPart = result.current.messages
        .flatMap((message) => message.parts)
        .find((part) => part.type === 'tool-call')
      if (!toolPart || toolPart.type !== 'tool-call') throw new Error('ツール表示がありません')
      const approvalView = render(
        createElement(ToolCallContent, { part: toolPart, approval: interrupt }),
      )
      await act(async () => {
        fireEvent.click(approvalView.getByRole('button', { name: approved ? '承認' : '拒否' }))
      })
      approvalView.unmount()
      await vi.waitFor(() => expect(result.current.isLoading).toBe(false))

      // Assert
      expect(requests).toHaveLength(2)
      expect(requests[1]).toMatchObject({
        threadId: 'approval-thread',
        parentRunId: requests[0]?.runId,
        forwardedProps: { model: 'gpt-oss:120b-cloud' },
        resume: [expect.objectContaining({ status: 'resolved' })],
      })
      expect(execute).toHaveBeenCalledTimes(approved ? 1 : 0)
      expect(calls).toHaveLength(2)
      expect(result.current.interrupts).toEqual([])
      expect(result.current.messages.flatMap((message) => message.parts)).toContainEqual(
        expect.objectContaining({ type: 'text', content: '完了' }),
      )
    },
  )
})

describe('標準 AG-UI 接続の添付本文', () => {
  it('添付本文をモデルへ渡し、表示用メタデータを会話に保持する', async () => {
    // Arrange
    const { calls } = prepareModel([{ text: '読みました' }])
    const { connection } = createConnection([])
    const attachmentPart = createChatAttachmentMessagePart({
      name: 'note.txt',
      size: 6,
      content: '添付本文',
    })
    const { result } = renderHook(() => useChat({ connection, threadId: 'attachment-thread' }))

    // Act
    await act(async () => {
      await result.current.sendMessage({
        content: [{ type: 'text', content: '読んでください' }, attachmentPart],
      })
    })

    // Assert
    expect(JSON.stringify(calls[0]?.messages)).toContain('添付本文')
    expect(result.current.messages[0]?.parts).toContainEqual(
      expect.objectContaining({
        type: 'text',
        metadata: { kind: 'chat-attachment', name: 'note.txt', size: 6 },
      }),
    )
    expect(result.current.messages.flatMap((message) => message.parts)).toContainEqual(
      expect.objectContaining({ type: 'text', content: '読みました' }),
    )
  })
})
