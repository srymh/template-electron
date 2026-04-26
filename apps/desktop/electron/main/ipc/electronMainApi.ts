import { createElectronApi } from '@repo/ipc/browser'

import type { AiChatApi, AI_CHAT_API_KEY } from '#/main/api/aiChat'
import type { AuthApi, AUTH_API_KEY } from '#/main/api/auth'
import type { FileSystemApi, FS_API_KEY } from '#/main/api/fs'
import type { KakeiboApi, Kakeibo_API_KEY } from '#/main/api/kakeibo'
import type { McpApi, MCP_API_KEY } from '#/main/api/mcp'
import type { ThemeApi, THEME_API_KEY } from '#/main/api/theme'
import type { WebApi, WEB_API_KEY } from '#/main/api/web'

type Api = {
  [FS_API_KEY]: FileSystemApi
  [THEME_API_KEY]: ThemeApi
  [WEB_API_KEY]: WebApi
  [MCP_API_KEY]: McpApi
  [AI_CHAT_API_KEY]: AiChatApi
  [Kakeibo_API_KEY]: KakeiboApi
  [AUTH_API_KEY]: AuthApi
}

export const electronMainApi = createElectronApi<Api>(
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
      aiChat: {
        chat: useChannelAsInvoke('aiChat.chat'),
        on: {
          chunk: useChannelAsEvent('aiChat.on.chunk'),
        },
      },
      kakeibo: {
        entries: useChannelAsInvoke('kakeibo.entries'),
      },
      auth: {
        getStatus: useChannelAsInvoke('auth.getStatus'),
        login: useChannelAsInvoke('auth.login'),
        logout: useChannelAsInvoke('auth.logout'),
      },
    }),
  {
    // useChannelAsEvent を使ったイベント登録の管理用マップ
    registeredEventMap: new Map(),
  },
)

export type ElectronMainApi = typeof electronMainApi
