import type { WebContents } from 'electron'

import { createRegisterIpc } from '@repo/ipc/main'

import type { ElectronMainApi } from '../api'
import { AI_CHAT_API_KEY, getAiChatApi } from '../api/ai-chat'
import type { AiChatContext } from '../api/ai-chat'
import { AUTH_API_KEY, getAuthApi } from '../api/auth'
import type { AuthContext } from '../api/auth'
import { FS_API_KEY, getFileSystemApi } from '../api/fs'
import type { FileSystemContext } from '../api/fs'
import { SECRET_API_KEY, getSecretApi } from '../api/secret'
import type { SecretContext } from '../api/secret'
import { STORAGE_DEMO_API_KEY, getStorageDemoApi } from '../api/storage-demo'
import type { StorageDemoContext } from '../api/storage-demo'
import { THEME_API_KEY, getThemeApi } from '../api/theme'
import type { ThemeContext } from '../api/theme'
import { TODO_API_KEY, getTodoApi } from '../api/todo'
import type { TodoContext } from '../api/todo'
import { WEB_API_KEY, getWebApi } from '../api/web'
import type { WebContext } from '../api/web'

export type Context = {
  [FS_API_KEY]: FileSystemContext
  [THEME_API_KEY]: ThemeContext
  [AI_CHAT_API_KEY]: AiChatContext
  [AUTH_API_KEY]: AuthContext
  [WEB_API_KEY]: WebContext
  [SECRET_API_KEY]: SecretContext
  [TODO_API_KEY]: TodoContext
  [STORAGE_DEMO_API_KEY]: StorageDemoContext
}

export const registerIpc = createRegisterIpc<ElectronMainApi, Context>(
  ({ getContext, defineHelper }) => {
    const fs = getFileSystemApi((wc: WebContents) => getContext(wc)[FS_API_KEY])
    const theme = getThemeApi((wc: WebContents) => getContext(wc)[THEME_API_KEY])
    const web = getWebApi((wc: WebContents) => getContext(wc)[WEB_API_KEY])
    const aiChat = getAiChatApi((wc: WebContents) => getContext(wc)[AI_CHAT_API_KEY])
    const auth = getAuthApi((wc: WebContents) => getContext(wc)[AUTH_API_KEY])
    const secret = getSecretApi((wc: WebContents) => getContext(wc)[SECRET_API_KEY])
    const todo = getTodoApi((wc: WebContents) => getContext(wc)[TODO_API_KEY])
    const storageDemo = getStorageDemoApi((wc: WebContents) => getContext(wc)[STORAGE_DEMO_API_KEY])

    // prettier-ignore
    return defineHelper({
      // 'this.should.cause.a.type.error': { type: 'invoke', method: () => {} },
      'fs.joinPath': { type: 'invoke', method: fs.joinPath },
      'fs.readFileAsText': { type: 'invoke', method: fs.readFileAsText },
      'fs.readFileAsArrayBuffer': { type: 'invoke', method: fs.readFileAsArrayBuffer },
      'fs.writeFileAsText': { type: 'invoke', method: fs.writeFileAsText },
      'fs.writeFileAsArrayBuffer': { type: 'invoke', method: fs.writeFileAsArrayBuffer },
      'fs.showOpenDialog': { type: 'invoke', method: fs.showOpenDialog },
      'fs.showSaveDialog': { type: 'invoke', method: fs.showSaveDialog },
      'fs.readDirectory': { type: 'invoke', method: fs.readDirectory },
      'fs.openFileByDefaultApp': { type: 'invoke', method: fs.openFileByDefaultApp },
      'fs.getFileDetails': { type: 'invoke', method: fs.getFileDetails },
      'fs.registerAppAssetDirectory': { type: 'invoke', method: fs.registerAppAssetDirectory },
      'fs.unregisterAppAssetRoot': { type: 'invoke', method: fs.unregisterAppAssetRoot },
      'fs.createAppAssetUrl': { type: 'invoke', method: fs.createAppAssetUrl },
      'theme.getTheme': { type: 'invoke', method: theme.getTheme },
      'theme.setTheme': { type: 'invoke', method: theme.setTheme },
      'theme.getAccentColor': { type: 'invoke', method: theme.getAccentColor },
      'theme.on.accentColorChanged': {
        type: 'event',
        addEventListener: theme.on.accentColorChanged,
      },
      'theme.on.updated': { type: 'event', addEventListener: theme.on.updated },
      'web.findInPage': { type: 'invoke', method: web.findInPage },
      'web.stopFindInPage': { type: 'invoke', method: web.stopFindInPage },
      'web.on.blur': { type: 'event', addEventListener: web.on.blur },
      'web.on.focus': { type: 'event', addEventListener: web.on.focus },
      'web.on.foundInPage': { type: 'event', addEventListener: web.on.foundInPage },
      'aiChat.chat': { type: 'invoke', method: aiChat.chat },
      'aiChat.ingestDocument': { type: 'invoke', method: aiChat.ingestDocument },
      'aiChat.on.chunk': { type: 'event', addEventListener: aiChat.on.chunk },
      'auth.getStatus': { type: 'invoke', method: auth.getStatus },
      'auth.login': { type: 'invoke', method: auth.login },
      'auth.logout': { type: 'invoke', method: auth.logout },
      'secret.setSecret': { type: 'invoke', method: secret.setSecret },

      /* Todo Api */
      'todo.list': { type: 'invoke', method: todo.list },
      'todo.get': { type: 'invoke', method: todo.get },
      'todo.create': { type: 'invoke', method: todo.create },
      'todo.update': { type: 'invoke', method: todo.update },
      'todo.setCompleted': { type: 'invoke', method: todo.setCompleted },
      'todo.remove': { type: 'invoke', method: todo.remove },

      /* Storage Demo Api */
      'storageDemo.objects.list': { type: 'invoke', method: storageDemo.objects.list },
      'storageDemo.objects.put': { type: 'invoke', method: storageDemo.objects.put },
      'storageDemo.objects.verify': { type: 'invoke', method: storageDemo.objects.verify },
      'storageDemo.objects.remove': { type: 'invoke', method: storageDemo.objects.remove },
      'storageDemo.tables.list': { type: 'invoke', method: storageDemo.tables.list },
      'storageDemo.tables.listRows': { type: 'invoke', method: storageDemo.tables.listRows },
      'storageDemo.tables.createRow': { type: 'invoke', method: storageDemo.tables.createRow },
      'storageDemo.tables.updateRow': { type: 'invoke', method: storageDemo.tables.updateRow },
      'storageDemo.tables.removeRow': { type: 'invoke', method: storageDemo.tables.removeRow },
    })
  },
)
