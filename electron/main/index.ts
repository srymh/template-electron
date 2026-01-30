import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { app, BrowserWindow, type WebContents } from 'electron'

import type { AiAgent } from './features/ai-agent/AiAgent'
import type { AuthRuntime } from './features/auth/authRuntime'
import { createAppDataBase, type DataBase } from './features/db/db'
import type { McpServer } from './features/mcp'
import { registerIpc, type Context } from './ipc/registerIpc'
import { startApp, type AppRuntime } from './app/startApp'
import { createAuthRuntime } from './features/auth/authRuntime'
import { resolveMainPaths, type MainPaths } from './infra/paths'
import { registerCustomProtocol } from './infra/registerCustomProtocol'
import { createWindow, recommendedSecureOptions } from './windows/createWindow'

/** __dirname の代替 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 開発時の Vite dev server URL */
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

/**
 * アプリケーション全体のコンテキスト。
 */
type AppContext = {
  windowsById: Map<number, BrowserWindow>
  windowContextMap: WeakMap<WebContents, Context>

  aiAgent: AiAgent | null
  mcpServer: McpServer | null
  db: DataBase | null
  authRuntime: AuthRuntime | null

  registerIpcCache: WeakMap<WebContents, Map<string, () => void>>
  paths: MainPaths
}

startApp<AppContext>({
  /** --------------------------------------------------------------------------
   *
   * app 準備完了後の処理
   *
   * ------------------------------------------------------------------------ */
  onAppReady: async ({ appContext }) => {
    registerCustomProtocol()

    // IPC登録（window が load して renderer が invoke する前に必ず登録しておく）
    registerIpc({
      getContext: (webContents) => {
        if (!appContext.windowContextMap.has(webContents)) {
          throw new Error('Context is not found')
        }
        return appContext.windowContextMap.get(webContents)!
      },
      cache: appContext.registerIpcCache,
    })
  },
  /** --------------------------------------------------------------------------
   *
   * メインウィンドウを開く
   *
   * ------------------------------------------------------------------------ */
  openMainWindow: ({ appRuntime, appContext }) => {
    const allowedDevOrigin = (() => {
      if (!VITE_DEV_SERVER_URL) return null
      try {
        return new URL(VITE_DEV_SERVER_URL).origin
      } catch {
        return null
      }
    })()

    /**
     * file://... のパスに必ず末尾セパレータをつける関数
     * 例: input: file:///path/to/dist -> output: file:///path/to/dist/
     * @param p パス
     * @returns 末尾セパレータ付きのパス
     */
    const ensureTrailingSeparator = (p: string) =>
      p.endsWith(path.sep) ? p : p + path.sep

    const rendererRootUrl = appContext.paths.rendererDist
      ? pathToFileURL(
          ensureTrailingSeparator(appContext.paths.rendererDist),
        ).toString()
      : null

    createWindow(
      async (win) => {
        if (VITE_DEV_SERVER_URL) {
          await win.loadURL(VITE_DEV_SERVER_URL)
        } else {
          await win.loadFile(appContext.paths.indexHtmlPath)
        }
      },
      {
        /** --------------------------------------------------------------------
         * BrowserWindow のオプション設定
         * ------------------------------------------------------------------ */
        browserWindowOptions: {
          icon: path.join(appContext.paths.vitePublic, 'app.ico'),
          autoHideMenuBar: true,
          webPreferences: {
            ...recommendedSecureOptions,
            preload: appContext.paths.preloadPath,
          },
        },
        /** --------------------------------------------------------------------
         * ナビゲーションポリシー設定
         * ------------------------------------------------------------------ */
        navigation: {
          allowedDevOrigin,
          rendererRootUrl,
        },
        /** --------------------------------------------------------------------
         * ライフサイクルフック
         * ------------------------------------------------------------------ */
        onCreated: (win) => {
          const windowContext = createWindowContext(win, {
            appRuntime,
            appContext,
          })
          appContext.windowContextMap.set(win.webContents, windowContext)
          appContext.windowsById.set(win.id, win)
        },
        onClose: (win) => {
          appContext.windowsById.delete(win.id)
          appContext.windowContextMap.delete(win.webContents)
        },
        onClosed: () => {
          // 何もしない
        },
      },
    ).catch((err) => {
      console.error(`Failed to create main window: ${String(err)}`)
    })
  },
  createAppContext: async () => {
    return {
      // TODO: BrowserWindow.getAllWindows() で代替できるか検討
      windowsById: new Map(),
      windowContextMap: new WeakMap(),
      aiAgent: null,
      mcpServer: null,
      db: null,
      authRuntime: null,
      registerIpcCache: new WeakMap(),
      paths: resolveMainPaths({
        isPackaged: app.isPackaged,
        dirname: __dirname,
      }),
    }
  },
})

function createWindowContext(
  win: BrowserWindow,
  {
    appRuntime,
    appContext,
  }: {
    appRuntime: AppRuntime
    appContext: AppContext
  },
): Context {
  // もし window 固有の情報を管理したい場合はここで追加する
  void win

  return {
    mcp: {
      getMcpServer: () => appContext.mcpServer,
      setMcpServer: (server) => {
        appContext.mcpServer = server
      },
    },
    aiAgent: {
      getAiAgent: () => appContext.aiAgent,
      setAiAgent: (agent) => {
        appContext.aiAgent = agent
      },
    },
    kakeibo: {
      getDb: () => {
        if (!appContext.db) {
          try {
            const db = createAppDataBase(
              path.join(appContext.paths.dataPath, 'kakeibo.db'),
              {
                readonly: false,
                fileMustExist: false,
              },
            )
            appContext.db = db
            console.log(`[DB] Database opened successfully at kakeibo.db`)
          } catch (error) {
            console.error('[DB] Failed to open database:', error)
            throw error
          }
        }
        return appContext.db
      },
    },
    auth: {
      getRuntime: () => {
        const runtime = appContext.authRuntime
        if (runtime) {
          return runtime
        }

        const newRuntime = createAuthRuntime()
        appContext.authRuntime = newRuntime
        appRuntime.addDispose(() => newRuntime.dispose())
        return newRuntime
      },
    },
  }
}
