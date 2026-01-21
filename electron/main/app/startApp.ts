import { app, BrowserWindow } from 'electron'
import { registerCustomProtocol } from '#/main/infra/registerCustomProtocol'
import { registerIpc } from '#/main/ipc/registerIpc'

import type { WebContents } from 'electron'
import type { MainPaths } from '#/main/infra/paths'
import type { AiAgent } from '#/main/features/ai-agent/AiAgent'
import type { McpServer } from '#/main/features/mcp'
import type { DataBase } from '#/main/features/db/db'
import type { AuthRuntime } from '#/main/features/auth/authRuntime'
import type { Context } from '#/main/ipc/registerIpc'

/**
 * アプリケーション全体のコンテキスト。
 */
export type AppContext = {
  windowsById: Map<number, BrowserWindow>
  windowContextMap: WeakMap<WebContents, Context>

  aiAgent: AiAgent | null
  mcpServer: McpServer | null
  db: DataBase | null
  authRuntime: AuthRuntime | null

  registerIpcCache: WeakMap<WebContents, Map<string, () => void>>
  paths: MainPaths

  /** before-quit で呼ばれる破棄処理（同期/非同期混在可） */
  disposeSet: Set<(() => void) | (() => Promise<void>)>
  isDisposed: boolean
}

export function startApp(options: {
  openMainWindow: (appContext: AppContext) => Promise<void>
  paths: MainPaths
}) {
  const { openMainWindow, paths } = options

  /** --------------------------------------------------------------------------
   *
   * app コンテキスト作成
   *
   * ------------------------------------------------------------------------ */

  const appContext: AppContext = {
    // TODO: BrowserWindow.getAllWindows() で代替できるか検討
    windowsById: new Map(),
    windowContextMap: new WeakMap(),
    aiAgent: null,
    mcpServer: null,
    db: null,
    authRuntime: null,
    registerIpcCache: new WeakMap(),
    paths,
    disposeSet: new Set(),
    isDisposed: false,
  }

  /** --------------------------------------------------------------------------
   *
   * app イベントハンドリング
   *
   * ------------------------------------------------------------------------ */

  /**
   * すべてのウィンドウが閉じられたときに発生します。
   *
   * https://www.electronjs.org/ja/docs/latest/api/app#%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88-window-all-closed
   */
  app.on('window-all-closed', () => {
    // すべてのウィンドウが閉じられたらアプリを終了します。ただし macOS では、
    // ユーザーが Cmd + Q で明示的に終了するまで、アプリケーションとメニューバーが
    // アクティブなままになるのが一般的です。
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  /**
   * [macOS 固有] アプリケーションがアクティブになったときに発生します。
   *
   * https://www.electronjs.org/ja/docs/latest/api/app#%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88-activate-macos
   */
  app.on('activate', () => {
    // macOS では、ドックアイコンがクリックされ、他に開いているウィンドウがない場合に
    // アプリ内でウィンドウを再作成するのが一般的です。
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow(appContext)
    }
  })

  /**
   * アプリケーションがウィンドウを閉じ始める前に発生します。
   *
   * https://www.electronjs.org/ja/docs/latest/api/app#%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88-before-quit
   */
  app.on('before-quit', (event) => {
    if (appContext.isDisposed) {
      return
    }

    // Node の EventEmitter は async handler を await しないため、
    // preventDefault して破棄処理完了後に quit を再実行する。
    event.preventDefault()
    appContext.isDisposed = true

    void (async () => {
      const disposers = Array.from(appContext.disposeSet)
      appContext.disposeSet.clear()

      const results = await Promise.allSettled(
        disposers.map(async (dispose) => {
          await dispose()
        }),
      )

      const rejected = results.filter((r) => r.status === 'rejected')
      if (rejected.length > 0) {
        console.error('[app:before-quit] dispose failed:', rejected)
      }

      // app.quit() だと before-quit が再度走る可能性があるため exit を使う
      app.exit(0)
    })()
  })

  /** --------------------------------------------------------------------------
   *
   * app 起動処理
   *
   * ------------------------------------------------------------------------ */

  app.whenReady().then(() => {
    registerCustomProtocol()

    // IPC登録（window が load して renderer が invoke する前に必ず登録しておく）
    registerIpc({
      getContext: (webContents: WebContents) => {
        if (!appContext.windowContextMap.has(webContents)) {
          throw new Error('Context is not found')
        }
        return appContext.windowContextMap.get(webContents)!
      },
      cache: appContext.registerIpcCache,
    })

    openMainWindow(appContext).catch((err) => {
      console.error('ウィンドウの作成に失敗しました:', err)
    })
  })
}
