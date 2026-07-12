import type { WebContents } from 'electron'

import type { AiChatSession } from '@repo/ai-chat-session'
import type { AuthRuntime } from '@repo/auth'
import type { McpServer } from '@repo/mcp-server-example'
import type { Database } from '@repo/sqlite'
import type { Context as ApiContext } from '@your-app-name/api/main'

export type WindowState = {
  aiChatSession: AiChatSession | null
}

export function createWindowState(): WindowState {
  return {
    aiChatSession: null,
  }
}

type WindowContext = {
  apiContext: ApiContext
  state: WindowState
}

class ApiContextRegistry<TScope> {
  private readonly scopeMap = new WeakMap<WebContents, TScope>()

  register(webContents: WebContents, scope: TScope): () => void {
    this.scopeMap.set(webContents, scope)
    return () => {
      this.scopeMap.delete(webContents)
    }
  }

  getOrThrow(webContents: WebContents): TScope {
    if (!this.scopeMap.has(webContents)) {
      throw new Error('Context is not found')
    }
    return this.scopeMap.get(webContents)!
  }
}

/**
 * アプリケーション全体のコンテキスト。
 */
export type AppContext = {
  mcpServer: McpServer | null
  db: Database | null
  authRuntime: AuthRuntime | null
  apiContexts: ApiContextRegistry<WindowContext>
}

export async function createAppContext(): Promise<AppContext> {
  return {
    mcpServer: null,
    db: null,
    authRuntime: null,
    apiContexts: new ApiContextRegistry<WindowContext>(),
  }
}
