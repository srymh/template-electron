import { describe, expect, it, vi } from 'vitest'
import { EventType } from '@tanstack/ai/client'

import type { ChatRequest, ChatResponse } from '../types'
import { aiChatAdapter } from './index'

describe('aiChatAdapter', () => {
  it('AG-UI の識別子・追加プロパティ・再開情報を運び、自分の応答だけを返す', async () => {
    // Arrange
    let receive: ((response: ChatResponse) => void) | undefined
    const dispose = vi.fn()
    const chat = vi.fn(async (request: ChatRequest & { id: string }) => {
      receive?.({ type: 'error', id: 'other-request', error: '無関係な要求' })
      receive?.({
        type: 'chunk',
        id: request.id,
        chunk: {
          type: EventType.RUN_STARTED,
          threadId: 'thread',
          runId: 'run',
          timestamp: 1,
        },
      })
      receive?.({ type: 'done', id: request.id })
    })
    const adapter = aiChatAdapter({
      chat,
      addListener: (listener) => {
        receive = listener
        return dispose
      },
    })

    // Act
    const chunks = []
    for await (const chunk of adapter.connect(
      [{ id: 'user', role: 'user', parts: [{ type: 'text', content: 'こんにちは' }] }],
      { model: 'qwen3.5:9b' },
      undefined,
      {
        threadId: 'thread',
        runId: 'run',
        parentRunId: 'previous-run',
        resume: [{ interruptId: 'approval', status: 'resolved', payload: { approved: true } }],
      },
    ))
      chunks.push(chunk)

    // Assert
    expect(chat.mock.calls[0]?.[0]).toMatchObject({
      messages: [{ id: 'user', role: 'user', content: 'こんにちは' }],
      threadId: 'thread',
      runId: 'run',
      parentRunId: 'previous-run',
      forwardedProps: { model: 'qwen3.5:9b' },
      resume: [{ interruptId: 'approval', status: 'resolved', payload: { approved: true } }],
    })
    expect(chunks).toEqual([
      { type: EventType.RUN_STARTED, threadId: 'thread', runId: 'run', timestamp: 1 },
    ])
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('invoke の失敗をストリームへ伝え、購読を解除する', async () => {
    // Arrange
    const dispose = vi.fn()
    const adapter = aiChatAdapter({
      chat: async () => {
        throw new Error('IPC failure')
      },
      addListener: () => dispose,
    })
    const consume = async () => {
      for await (const _chunk of adapter.connect([], {}, undefined, {
        threadId: 'thread',
        runId: 'run',
      })) {
        // 失敗までストリームを消費する。
      }
    }

    // Act / Assert
    await expect(consume()).rejects.toThrow('IPC failure')
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('待機中の abort でストリームを終了し、購読を解除する', async () => {
    // Arrange
    let markStarted = () => {}
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const dispose = vi.fn()
    const controller = new AbortController()
    const adapter = aiChatAdapter({
      chat: async () => {
        markStarted()
      },
      addListener: () => dispose,
    })
    const consume = async () => {
      const chunks = []
      for await (const chunk of adapter.connect([], {}, controller.signal, {
        threadId: 'thread',
        runId: 'run',
      })) {
        chunks.push(chunk)
      }
      return chunks
    }

    // Act
    const consumption = consume()
    await started
    controller.abort()
    const chunks = await consumption

    // Assert
    expect(chunks).toEqual([])
    expect(dispose).toHaveBeenCalledTimes(1)
  })
})
