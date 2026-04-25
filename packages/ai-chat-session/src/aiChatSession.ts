import type { ChatResponse } from '@repo/ai-chat'
import { createAsyncQueue } from '@repo/async-queue'
import type { AsyncQueue } from '@repo/async-queue'

export type AiChatSessionPhase = 'idle' | 'running' | 'completed'

export type AiChatSession = {
  queue: AsyncQueue<ChatResponse>
  phase: AiChatSessionPhase
  listenerAttached: boolean
}

export type AiChatSessionStore = {
  getSession: () => AiChatSession | null
  setSession: (session: AiChatSession | null) => void
}

const inProgressMessage =
  'A chat session is already in progress. Please wait for it to complete before starting a new one.'

export function createAiChatSession(): AiChatSession {
  return {
    queue: createAsyncQueue<ChatResponse>(),
    phase: 'idle',
    listenerAttached: false,
  }
}

export function attachAiChatListener(store: AiChatSessionStore): AiChatSession {
  const session = store.getSession() ?? createAiChatSession()

  if (store.getSession() == null) {
    store.setSession(session)
  }

  session.listenerAttached = true
  return session
}

export function prepareAiChatSessionForChat(store: AiChatSessionStore): AiChatSession {
  const current = store.getSession()
  if (current == null) {
    const session = createAiChatSession()
    store.setSession(session)
    return session
  }

  if (current.phase === 'running') {
    throw new Error(inProgressMessage)
  }

  if (current.phase === 'completed') {
    if (current.listenerAttached) {
      throw new Error(inProgressMessage)
    }

    const session = createAiChatSession()
    store.setSession(session)
    return session
  }

  return current
}

export function markAiChatSessionRunning(session: AiChatSession) {
  session.phase = 'running'
}

export function markAiChatSessionCompleted(session: AiChatSession) {
  session.phase = 'completed'
}

export function clearAiChatSession(store: AiChatSessionStore, session: AiChatSession) {
  session.listenerAttached = false
  session.queue.close()

  if (store.getSession() === session) {
    store.setSession(null)
  }
}
