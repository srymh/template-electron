import { createRegisterIpc } from '#/shared/lib/ipc/main'
import { getFileSystemApi } from '#/main/api/fs'
import { THEME_API_KEY, getThemeApi } from '#/main/api/theme'
import { getWebApi } from '#/main/api/web'
import { MCP_API_KEY, getMcpApi } from '#/main/api/mcp'
import { AI_AGENT_API_KEY, getAiAgentApi } from '#/main/api/aiAgent'
import { getAiChatApi } from '#/main/api/aiChat'
import { Kakeibo_API_KEY, getKakeiboApi } from '#/main/api/kakeibo'
import { AUTH_API_KEY, getAuthApi } from '#/main/api/auth'

import type { WebContents } from 'electron'
import type { ThemeContext } from '#/main/api/theme'
import type { McpApiContext } from '#/main/api/mcp'
import type { AiAgentContext } from '#/main/api/aiAgent'
import type { KakeiboContext } from '#/main/api/kakeibo'
import type { AuthContext } from '#/main/api/auth'
import type { ElectronMainApi } from './electronApi'

export type Context = {
  [THEME_API_KEY]: ThemeContext
  [MCP_API_KEY]: McpApiContext
  [AI_AGENT_API_KEY]: AiAgentContext
  [Kakeibo_API_KEY]: KakeiboContext
  [AUTH_API_KEY]: AuthContext
}

export const registerIpc = createRegisterIpc<ElectronMainApi, Context>(
  ({ getContext, defineHelper }) => {
    const fs = getFileSystemApi()
    const theme = getThemeApi(
      (wc: WebContents) => getContext(wc)[THEME_API_KEY],
    )
    const web = getWebApi()
    const mcp = getMcpApi((wc: WebContents) => getContext(wc)[MCP_API_KEY])
    const aiAgent = getAiAgentApi(
      (wc: WebContents) => getContext(wc)[AI_AGENT_API_KEY],
    )
    const aiChat = getAiChatApi()
    const kakeibo = getKakeiboApi(
      (wc: WebContents) => getContext(wc)[Kakeibo_API_KEY],
    )
    const auth = getAuthApi((wc: WebContents) => getContext(wc)[AUTH_API_KEY])

    return defineHelper({
      // 'this.should.cause.a.type.error': { type: 'invoke', method: () => {} },
      'fs.joinPath': { type: 'invoke', method: fs.joinPath },
      'fs.readFileAsText': { type: 'invoke', method: fs.readFileAsText },
      'fs.readFileAsArrayBuffer': {
        type: 'invoke',
        method: fs.readFileAsArrayBuffer,
      },
      'fs.writeFileAsText': { type: 'invoke', method: fs.writeFileAsText },
      'fs.writeFileAsArrayBuffer': {
        type: 'invoke',
        method: fs.writeFileAsArrayBuffer,
      },
      'fs.showOpenDialog': { type: 'invoke', method: fs.showOpenDialog },
      'fs.showSaveDialog': { type: 'invoke', method: fs.showSaveDialog },
      'fs.readDirectory': { type: 'invoke', method: fs.readDirectory },
      'fs.openFileByDefaultApp': {
        type: 'invoke',
        method: fs.openFileByDefaultApp,
      },
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
      'web.on.foundInPage': {
        type: 'event',
        addEventListener: web.on.foundInPage,
      },
      'mcp.getServerStatus': { type: 'invoke', method: mcp.getServerStatus },
      'mcp.startServer': { type: 'invoke', method: mcp.startServer },
      'mcp.stopServer': { type: 'invoke', method: mcp.stopServer },
      'aiAgent.setup': { type: 'invoke', method: aiAgent.setup },
      'aiAgent.send': { type: 'invoke', method: aiAgent.send },
      'aiAgent.getHistory': { type: 'invoke', method: aiAgent.getHistory },
      'aiAgent.on.chunk': { type: 'event', addEventListener: aiAgent.on.chunk },
      'aiAgent.on.done': { type: 'event', addEventListener: aiAgent.on.done },
      'aiAgent.on.error': { type: 'event', addEventListener: aiAgent.on.error },
      'aiChat.chat': { type: 'invoke', method: aiChat.chat },
      'aiChat.on.chunk': { type: 'event', addEventListener: aiChat.on.chunk },
      'kakeibo.entries': { type: 'invoke', method: kakeibo.entries },
      'auth.getStatus': { type: 'invoke', method: auth.getStatus },
      'auth.login': { type: 'invoke', method: auth.login },
      'auth.logout': { type: 'invoke', method: auth.logout },
    })
  },
)
