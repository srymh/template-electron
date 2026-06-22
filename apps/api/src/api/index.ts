import type { DeepMerge } from '@repo/deep-merge'

import type { AiChatApi, AI_CHAT_API_KEY } from './aiChat'
import type { AuthApi, AUTH_API_KEY } from './auth'
import type { FileSystemApi, FileSystemRendererApi, FS_API_KEY } from './fs'
import type { KakeiboApi, Kakeibo_API_KEY } from './kakeibo'
import type { McpApi, MCP_API_KEY } from './mcp'
import type { SecretApi, SECRET_API_KEY } from './secret'
import type { ThemeApi, THEME_API_KEY } from './theme'
import type { WebApi, WEB_API_KEY } from './web'

export type ElectronMainApi = {
  [FS_API_KEY]: FileSystemApi
  [THEME_API_KEY]: ThemeApi
  [WEB_API_KEY]: WebApi
  [MCP_API_KEY]: McpApi
  [AI_CHAT_API_KEY]: AiChatApi
  [Kakeibo_API_KEY]: KakeiboApi
  [AUTH_API_KEY]: AuthApi
  [SECRET_API_KEY]: SecretApi
}

export type ElectronRendererApi = {
  [FS_API_KEY]: FileSystemRendererApi
}

export type ElectronApi = DeepMerge<ElectronMainApi, ElectronRendererApi>
