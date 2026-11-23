import type { DeepMerge } from '@repo/deep-merge'

import type { AiChatApi, AI_CHAT_API_KEY } from './ai-chat'
import type { AuthApi, AUTH_API_KEY } from './auth'
import type { FileSystemApi, FileSystemRendererApi, FS_API_KEY } from './fs'
import type { SecretApi, SECRET_API_KEY } from './secret'
import type { StorageDemoApi, STORAGE_DEMO_API_KEY } from './storage-demo'
import type { ThemeApi, THEME_API_KEY } from './theme'
import type { TodoApi, TODO_API_KEY } from './todo'
import type { WebApi, WEB_API_KEY } from './web'

export type ElectronMainApi = {
  [FS_API_KEY]: FileSystemApi
  [THEME_API_KEY]: ThemeApi
  [WEB_API_KEY]: WebApi
  [AI_CHAT_API_KEY]: AiChatApi
  [AUTH_API_KEY]: AuthApi
  [SECRET_API_KEY]: SecretApi
  [TODO_API_KEY]: TodoApi
  [STORAGE_DEMO_API_KEY]: StorageDemoApi
}

export type ElectronRendererApi = {
  [FS_API_KEY]: FileSystemRendererApi
}

export type ElectronApi = DeepMerge<ElectronMainApi, ElectronRendererApi>
