import { webUtils } from 'electron'
import { createElectronApi } from '../lib/ipc/browser'

import type {
  FileSystemApi,
  FileSystemRendererApi,
  FS_API_KEY,
} from '../features/fs'
import type { ThemeApi, THEME_API_KEY } from '../features/theme'
import type { WebApi, WEB_API_KEY } from '../features/web'
import type { McpApi, MCP_API_KEY } from '../features/mcp'
import type { AiAgentApi, AI_AGENT_API_KEY } from '../features/aiAgent'
import type { KakeiboApi, Kakeibo_API_KEY } from '../features/kakeibo'

type ElectronRendererApi = {
  [FS_API_KEY]: FileSystemRendererApi
}

export type ElectronMainApi = {
  [FS_API_KEY]: FileSystemApi
  [THEME_API_KEY]: ThemeApi
  [WEB_API_KEY]: WebApi
  [MCP_API_KEY]: McpApi
  [AI_AGENT_API_KEY]: AiAgentApi
  [Kakeibo_API_KEY]: KakeiboApi
}

const getPathForFile: FileSystemRendererApi['getPathForFile'] = async (
  options,
) => webUtils.getPathForFile(options.file)

export const electronApi = createElectronApi<
  ElectronMainApi,
  ElectronRendererApi
>(
  ({ defineHelper, useChannelAsInvoke, useChannelAsEvent }) =>
    /**
     * defineHelper の使用は任意ですが、以下の利点があります。
     * 1. 型推論を助けるために利用することができます。
     * 2. 誤ったチャネル名を使用した場合に型エラーを発生させることができます。
     */
    defineHelper({
      fs: {
        // 'this.should.cause.a.type.error': () => {},
        joinPath: useChannelAsInvoke('fs.joinPath'),
        readFileAsText: useChannelAsInvoke('fs.readFileAsText'),
        readFileAsArrayBuffer: useChannelAsInvoke('fs.readFileAsArrayBuffer'),
        writeFileAsText: useChannelAsInvoke('fs.writeFileAsText'),
        writeFileAsArrayBuffer: useChannelAsInvoke('fs.writeFileAsArrayBuffer'),
        showOpenDialog: useChannelAsInvoke('fs.showOpenDialog'),
        showSaveDialog: useChannelAsInvoke('fs.showSaveDialog'),
        readDirectory: useChannelAsInvoke('fs.readDirectory'),
        openFileByDefaultApp: useChannelAsInvoke('fs.openFileByDefaultApp'),
        getFileDetails: useChannelAsInvoke('fs.getFileDetails'),
      },
      theme: {
        getTheme: useChannelAsInvoke('theme.getTheme'),
        setTheme: useChannelAsInvoke('theme.setTheme'),
        getAccentColor: useChannelAsInvoke('theme.getAccentColor'),
        on: {
          accentColorChanged: useChannelAsEvent('theme.on.accentColorChanged'),
          updated: useChannelAsEvent('theme.on.updated'),
        },
      },
      web: {
        findInPage: useChannelAsInvoke('web.findInPage'),
        stopFindInPage: useChannelAsInvoke('web.stopFindInPage'),
        on: {
          blur: useChannelAsEvent('web.on.blur'),
          focus: useChannelAsEvent('web.on.focus'),
          foundInPage: useChannelAsEvent('web.on.foundInPage'),
        },
      },
      mcp: {
        getServerStatus: useChannelAsInvoke('mcp.getServerStatus'),
        startServer: useChannelAsInvoke('mcp.startServer'),
        stopServer: useChannelAsInvoke('mcp.stopServer'),
      },
      aiAgent: {
        setup: useChannelAsInvoke('aiAgent.setup'),
        send: useChannelAsInvoke('aiAgent.send'),
        getHistory: useChannelAsInvoke('aiAgent.getHistory'),
        on: {
          chunk: useChannelAsEvent('aiAgent.on.chunk'),
          done: useChannelAsEvent('aiAgent.on.done'),
          error: useChannelAsEvent('aiAgent.on.error'),
        },
      },
      kakeibo: {
        entries: useChannelAsInvoke('kakeibo.entries'),
      },
    }),
  ({ defineHelper }) =>
    /**
     * defineHelper の使用は任意ですが、以下の利点があります。
     * 1. 型推論を助けるために利用することができます。
     * 2. 誤ったチャネル名を使用した場合に型エラーを発生させることができます。
     */
    defineHelper({
      // 'this.should.cause.a.type.error': () => {},
      fs: {
        getPathForFile,
      },
    }),
  {
    // useChannelAsEvent を使ったイベント登録の管理用マップ
    registeredEventMap: new Map(),
  },
)

export type ElectronApi = typeof electronApi
