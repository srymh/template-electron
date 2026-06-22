import type { WebContents } from 'electron'

import { createRegisterIpc } from '@repo/ipc/main'

import type { ElectronMainApi } from '../api'
import { AI_CHAT_API_KEY, getAiChatApi } from '../api/aiChat'
import type { AiChatContext } from '../api/aiChat'
import { AUTH_API_KEY, getAuthApi } from '../api/auth'
import type { AuthContext } from '../api/auth'
import { getFileSystemApi } from '../api/fs'
import { Kakeibo_API_KEY, getKakeiboApi } from '../api/kakeibo'
import type { KakeiboContext } from '../api/kakeibo'
import { MCP_API_KEY, getMcpApi } from '../api/mcp'
import type { McpApiContext } from '../api/mcp'
import { SECRET_API_KEY, getSecretApi } from '../api/secret'
import type { SecretContext } from '../api/secret'
import { THEME_API_KEY, getThemeApi } from '../api/theme'
import type { ThemeContext } from '../api/theme'
import { WEB_API_KEY, getWebApi } from '../api/web'
import type { WebContext } from '../api/web'

export type Context = {
  [THEME_API_KEY]: ThemeContext
  [MCP_API_KEY]: McpApiContext
  [AI_CHAT_API_KEY]: AiChatContext
  [Kakeibo_API_KEY]: KakeiboContext
  [AUTH_API_KEY]: AuthContext
  [WEB_API_KEY]: WebContext
  [SECRET_API_KEY]: SecretContext
}

export const registerIpc = createRegisterIpc<ElectronMainApi, Context>(
  ({ getContext, defineHelper }) => {
    const fs = getFileSystemApi()
    const theme = getThemeApi((wc: WebContents) => getContext(wc)[THEME_API_KEY])
    const web = getWebApi((wc: WebContents) => getContext(wc)[WEB_API_KEY])
    const mcp = getMcpApi((wc: WebContents) => getContext(wc)[MCP_API_KEY])
    const aiChat = getAiChatApi((wc: WebContents) => getContext(wc)[AI_CHAT_API_KEY])
    const kakeibo = getKakeiboApi((wc: WebContents) => getContext(wc)[Kakeibo_API_KEY])
    const auth = getAuthApi((wc: WebContents) => getContext(wc)[AUTH_API_KEY])
    const secret = getSecretApi((wc: WebContents) => getContext(wc)[SECRET_API_KEY])

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
      'mcp.getServerStatus': { type: 'invoke', method: mcp.getServerStatus },
      'mcp.startServer': { type: 'invoke', method: mcp.startServer },
      'mcp.stopServer': { type: 'invoke', method: mcp.stopServer },
      'aiChat.chat': { type: 'invoke', method: aiChat.chat },
      'aiChat.on.chunk': { type: 'event', addEventListener: aiChat.on.chunk },
      'kakeibo.entries': { type: 'invoke', method: kakeibo.entries },
      'auth.getStatus': { type: 'invoke', method: auth.getStatus },
      'auth.login': { type: 'invoke', method: auth.login },
      'auth.logout': { type: 'invoke', method: auth.logout },
      'secret.setSecret': { type: 'invoke', method: secret.setSecret },
    })
  },
)
