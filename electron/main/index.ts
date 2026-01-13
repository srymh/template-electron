import { app, BrowserWindow } from 'electron'
import { registerCustomProtocol } from './infra/registerCustomProtocol'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { createContextMenu } from './windows/contextMenu'
import { registerIpc } from './ipc/register'

import type { WebContents } from 'electron'
import type { AiAgent } from './services/ai-agent/AiAgent'
import type { McpServer } from './services/mcp'
import type { DataBase } from './services/db/db'
import type { Context as AppContext } from './ipc/register'

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├─┬ main
// │ │ │ └── index.js
// │ │ └─┬ preload
// │ │   └── index.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..', '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null
let aiAgent: AiAgent | null = null
let mcpServer: McpServer | null = null
let db: DataBase | null = null
const registerIpcCache = new WeakMap<WebContents, Map<string, () => void>>()
const contextMap = new WeakMap<WebContents, AppContext>()

function createWindow() {
  const wind = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.mjs'),
    },
  })
  win = wind

  win.webContents.on('context-menu', (_, params) => {
    if (win == null) return
    const menu = createContextMenu(win.webContents)
    menu.popup({
      window: win,
      x: params.x,
      y: params.y,
    })
  })

  contextMap.set(wind.webContents, {
    mcp: {
      getMcpServer: () => mcpServer,
      setMcpServer: (server) => {
        mcpServer = server
      },
    },
    aiAgent: {
      getAiAgent: () => aiAgent,
      setAiAgent: (agent) => {
        aiAgent = agent
      },
    },
    kakeibo: {
      getDb: () => db,
      setDb: (newDb) => {
        db = newDb
      },
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  registerCustomProtocol()

  // IPC登録（window が load して renderer が invoke する前に必ず登録しておく）
  registerIpc({
    getContext: (webContents: WebContents) => {
      if (!contextMap.has(webContents)) {
        throw new Error('Context is not found')
      }
      return contextMap.get(webContents)!
    },
    cache: registerIpcCache,
  })

  createWindow()
})
