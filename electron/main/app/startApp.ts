import { app, BrowserWindow } from 'electron'

export interface AppRuntime {
  // 破棄処理を追加する
  addDispose(dispose: () => void | Promise<void>): void
}

export async function startApp<TAppContext>(options: {
  onAppReady: ({
    appRuntime,
    appContext,
  }: {
    appRuntime: AppRuntime
    appContext: TAppContext
  }) => void | Promise<void>
  openMainWindow: ({
    appRuntime,
    appContext,
  }: {
    appRuntime: AppRuntime
    appContext: TAppContext
  }) => void
  createAppContext: () => Promise<TAppContext>
}) {
  const { onAppReady, openMainWindow, createAppContext } = options

  const appContext: TAppContext = await createAppContext()

  /** before-quit で呼ばれる破棄処理（同期/非同期混在可） */
  const disposeSet: Set<(() => void) | (() => Promise<void>)> = new Set()
  let isDisposing = false

  const appRuntime: AppRuntime = {
    addDispose(dispose) {
      disposeSet.add(dispose)
    },
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
      openMainWindow({ appRuntime, appContext })
    }
  })

  /**
   * アプリケーションがウィンドウを閉じ始める前に発生します。
   *
   * https://www.electronjs.org/ja/docs/latest/api/app#%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88-before-quit
   */
  app.on('before-quit', (event) => {
    if (isDisposing) {
      event.preventDefault()
      return
    }
    isDisposing = true

    // Node の EventEmitter は async handler を await しないため、
    // preventDefault して破棄処理完了後に quit を再実行する。
    event.preventDefault()

    void (async () => {
      const disposers = Array.from(disposeSet)
      disposeSet.clear()

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

  // app が準備完了するまで待機
  await app.whenReady()

  // app が準備完了した後の処理
  await onAppReady({ appRuntime, appContext })

  // メインウィンドウを開く
  openMainWindow({ appRuntime, appContext })
}
