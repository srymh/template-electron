import type { Context as ApiContext } from '@your-app-name/api/main'

import { createAiChatFeature } from '../features/ai-chat'
import { createAuthFeature } from '../features/auth'
import { createFileSystemFeature } from '../features/fs'
import { createSecretFeature } from '../features/secret'
import { createStorageDemoFeature } from '../features/storage-demo'
import { createThemeFeature } from '../features/theme'
import { createTodoFeature } from '../features/todo'
import { createWebFeature } from '../features/web'
import type { DesktopFeatureFactory } from './feature'

/**
 * 全機能を一度ずつ構築し、windowごとのAPI contextへ束ねる。
 * @param host - アプリ単位の実行環境能力
 * @returns 全機能のcontextをwindowごとに生成する機能
 */
export const createApiFeature: DesktopFeatureFactory<ApiContext> = (host) => {
  const fs = createFileSystemFeature(host)
  const theme = createThemeFeature(host)
  const aiChat = createAiChatFeature(host)
  const auth = createAuthFeature(host)
  const web = createWebFeature(host)
  const secret = createSecretFeature(host)
  const todo = createTodoFeature(host)
  const storageDemo = createStorageDemoFeature(host)

  return {
    createWindowContext: (windowHost) => ({
      fs: fs.createWindowContext(windowHost),
      theme: theme.createWindowContext(windowHost),
      aiChat: aiChat.createWindowContext(windowHost),
      auth: auth.createWindowContext(windowHost),
      web: web.createWindowContext(windowHost),
      secret: secret.createWindowContext(windowHost),
      todo: todo.createWindowContext(windowHost),
      storageDemo: storageDemo.createWindowContext(windowHost),
    }),
  }
}
