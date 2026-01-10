import { createRegisterIpc } from '../lib/ipc/main'
import { getFileSystemApi } from '../features/fs'
import { getThemeApi } from '../features/theme'
import { getWebApi } from '../features/web'
import { MCP_API_KEY, getMcpApi } from '../features/mcp'
import { AI_AGENT_API_KEY, getAiAgentApi } from '../features/aiAgent'
import { Kakeibo_API_KEY, getKakeiboApi } from '../features/kakeibo'

import type { WebContents } from 'electron'
import type { McpApiContext } from '../features/mcp'
import type { AiAgentContext } from '../features/aiAgent'
import type { KakeiboContext } from '../features/kakeibo'
import type { ElectronMainApi } from './electronApi'

export type Context = {
  [MCP_API_KEY]: McpApiContext
  [AI_AGENT_API_KEY]: AiAgentContext
  [Kakeibo_API_KEY]: KakeiboContext
}

export const registerIpc = createRegisterIpc<ElectronMainApi, Context>(
  ({ getContext, defineHelper }) => {
    const fs = getFileSystemApi()
    const theme = getThemeApi()
    const web = getWebApi()
    const mcp = getMcpApi(
      (webContents: WebContents) => getContext(webContents)[MCP_API_KEY],
    )
    const aiAgent = getAiAgentApi(
      (webContents: WebContents) => getContext(webContents)[AI_AGENT_API_KEY],
    )
    const kakeibo = getKakeiboApi(
      (webContents: WebContents) => getContext(webContents)[Kakeibo_API_KEY],
    )

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
      'kakeibo.entries': { type: 'invoke', method: kakeibo.entries },
    })
  },
)
