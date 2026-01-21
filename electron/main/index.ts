import { BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createWindow } from './windows/createWindow'
import { createAuthRuntime } from './features/auth/authRuntime'
import type { Context } from './ipc/registerIpc'
import { startApp, type AppContext } from './app/startApp'
import { resolveMainPaths } from './infra/paths'

/** __dirname の代替 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 開発時の Vite dev server URL */
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

startApp({
  openMainWindow,
  paths: resolveMainPaths({
    dirname: __dirname,
    viteDevServerUrl: VITE_DEV_SERVER_URL,
  }),
})

async function openMainWindow(ctx: AppContext) {
  await createWindow(
    async (win) => {
      if (VITE_DEV_SERVER_URL) {
        await win.loadURL(VITE_DEV_SERVER_URL)
      } else {
        await win.loadFile(ctx.paths.indexHtmlPath)
      }
    },
    {
      browserWindowOptions: {
        icon: ctx.paths.iconPath,
        webPreferences: {
          preload: ctx.paths.preloadPath,
        },
      },
      onCreated: (win) => {
        const windowContext = createWindowContext(ctx, win)
        ctx.windowContextMap.set(win.webContents, windowContext)
        ctx.windowsById.set(win.id, win)
      },
      onClose: (win) => {
        ctx.windowsById.delete(win.id)
        ctx.windowContextMap.delete(win.webContents)
      },
      onClosed: () => {
        // 何もしない
      },
    },
  )
}

function createWindowContext(ctx: AppContext, win: BrowserWindow): Context {
  // もし window 固有の情報を管理したい場合はここで追加する
  void win

  return {
    mcp: {
      getMcpServer: () => ctx.mcpServer,
      setMcpServer: (server) => {
        ctx.mcpServer = server
      },
    },
    aiAgent: {
      getAiAgent: () => ctx.aiAgent,
      setAiAgent: (agent) => {
        ctx.aiAgent = agent
      },
    },
    kakeibo: {
      getDb: () => ctx.db,
      setDb: (newDb) => {
        ctx.db = newDb
      },
    },
    auth: {
      getRuntime: () => {
        const runtime = ctx.authRuntime
        if (runtime) {
          return runtime
        }

        const newRuntime = createAuthRuntime()
        ctx.authRuntime = newRuntime
        ctx.disposeSet.add(() => newRuntime.dispose())
        return newRuntime
      },
    },
  }
}
