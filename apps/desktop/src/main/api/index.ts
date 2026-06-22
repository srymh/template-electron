import type { Context as ApiContext } from '@your-app-name/api/main'

import { createAiChatContext } from './ai-chat'
import { createAuthContext } from './auth'
import { createKakeiboContext } from './kakeibo'
import { createMcpContext } from './mcp'
import { createSecretContext } from './secret'
import { createThemeContext } from './theme'
import type { CreateApiContext } from './types'
import { createWebContext } from './web'

export const createWindowApiContext: CreateApiContext<ApiContext> = (options) => {
  return {
    theme: createThemeContext(options),
    mcp: createMcpContext(options),
    aiChat: createAiChatContext(options),
    kakeibo: createKakeiboContext(options),
    auth: createAuthContext(options),
    web: createWebContext(options),
    secret: createSecretContext(options),
  }
}
