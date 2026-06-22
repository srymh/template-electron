import { app, BrowserWindow } from 'electron'

import type { AppRuntime } from './app-runtime'

export type OnAppReady = ({ appRuntime }: { appRuntime: AppRuntime }) => void | Promise<void>

export type OpenMainWindow = ({ appRuntime }: { appRuntime: AppRuntime }) => void

export type StartAppOptions = {
  appRuntime: AppRuntime
  onAppReady: OnAppReady
  openMainWindow: OpenMainWindow
}

export async function startApp(options: StartAppOptions) {
  const { appRuntime, onAppReady, openMainWindow } = options

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
      openMainWindow({ appRuntime })
    }
  })

  /**
   * アプリケーションがウィンドウを閉じ始める前に発生します。
   *
   * https://www.electronjs.org/ja/docs/latest/api/app#%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88-before-quit
   */
  app.on('before-quit', (event) => {
    // Node の EventEmitter は async handler を await しないため、
    // preventDefault して破棄処理完了後に exit する。
    event.preventDefault()

    // IIFEの理由: Node.js の EventEmitter は async handler を await しないため
    void (async () => {
      try {
        const shouldExit = await appRuntime.dispose()
        if (!shouldExit) {
          return
        }
      } catch (err) {
        console.error('[app:before-quit] dispose did not finish; force exiting:', err)
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

  // app が準備完了するまで待機
  await app.whenReady()

  // app が準備完了した後の処理
  await onAppReady({ appRuntime })

  // メインウィンドウを開く
  openMainWindow({ appRuntime })
}
