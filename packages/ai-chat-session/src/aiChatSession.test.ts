import { describe, expect, it } from 'vitest'

import {
  attachAiChatListener,
  clearAiChatSession,
  createAiChatSession,
  markAiChatSessionCompleted,
  markAiChatSessionRunning,
  prepareAiChatSessionForChat,
} from './aiChatSession'
import type { AiChatSession, AiChatSessionStore } from './aiChatSession'

function createSessionStore(): AiChatSessionStore {
  let current: AiChatSession | null = null

  return {
    getSession: () => current,
    setSession: (session) => {
      current = session
    },
  }
}

describe('aiChatSession', () => {
  it('reuses a listener-prepared session when chat starts later', async () => {
    const store = createSessionStore()

    const listenerSession = attachAiChatListener(store)
    const chatSession = prepareAiChatSessionForChat(store)

    expect(chatSession).toBe(listenerSession)

    markAiChatSessionRunning(chatSession)
    chatSession.queue.push({ type: 'done', id: 'chat-1' })
    markAiChatSessionCompleted(chatSession)
    chatSession.queue.close()

    await expect(listenerSession.queue.shift()).resolves.toEqual({ type: 'done', id: 'chat-1' })
    await expect(listenerSession.queue.shift()).resolves.toBeUndefined()
  })

  it('lets a listener attach after chat has already produced results', async () => {
    const store = createSessionStore()

    const chatSession = prepareAiChatSessionForChat(store)
    markAiChatSessionRunning(chatSession)
    chatSession.queue.push({ type: 'done', id: 'chat-2' })
    markAiChatSessionCompleted(chatSession)
    chatSession.queue.close()

    const listenerSession = attachAiChatListener(store)

    expect(listenerSession).toBe(chatSession)
    await expect(listenerSession.queue.shift()).resolves.toEqual({ type: 'done', id: 'chat-2' })
    await expect(listenerSession.queue.shift()).resolves.toBeUndefined()
  })

  it('replaces a completed session when no listener remains attached', () => {
    const store = createSessionStore()

    const first = prepareAiChatSessionForChat(store)
    markAiChatSessionRunning(first)
    markAiChatSessionCompleted(first)
    first.queue.close()

    const second = prepareAiChatSessionForChat(store)

    expect(second).not.toBe(first)
    expect(store.getSession()).toBe(second)
  })

  it('blocks a new chat while a completed session is still attached to a listener', () => {
    const store = createSessionStore()

    const session = attachAiChatListener(store)
    const sameSession = prepareAiChatSessionForChat(store)

    markAiChatSessionRunning(sameSession)
    markAiChatSessionCompleted(sameSession)
    sameSession.queue.close()

    expect(session).toBe(sameSession)
    expect(() => prepareAiChatSessionForChat(store)).toThrow(
      'A chat session is already in progress.',
    )
  })

  it('clears only the current session reference', () => {
    const store = createSessionStore()

    const stale = attachAiChatListener(store)
    const current = createAiChatSession()
    store.setSession(current)

    clearAiChatSession(store, stale)
    expect(store.getSession()).toBe(current)

    clearAiChatSession(store, current)
    expect(store.getSession()).toBeNull()
  })
})
