import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { createContextMenu } from './createContextMenu'

export async function createWindow(
  loadRenderer: (win: BrowserWindow) => Promise<void>,
  options: {
    browserWindowOptions?: BrowserWindowConstructorOptions
    /**
     * ライフサイクルフック: ウィンドウ作成後の処理
     * @param win 作成されたウィンドウ
     */
    onCreated?: (win: BrowserWindow) => void
    /**
     * ライフサイクルフック: ウィンドウがクローズされようとするときの処理
     * @param win クローズされようとしているウィンドウ
     */
    onClose?: (win: BrowserWindow) => void
    /**
     * ライフサイクルフック: ウィンドウが閉じられた後の処理
     */
    onClosed?: () => void
  } = {},
) {
  const { browserWindowOptions, onCreated, onClose, onClosed } = options

  /** --------------------------------------------------------------------------
   *
   * BrowserWindow 作成
   *
   * ------------------------------------------------------------------------ */

  const win = new BrowserWindow({
    ...browserWindowOptions,
    webPreferences: {
      ...browserWindowOptions?.webPreferences,
      // セキュリティ強化のために contextIsolation が省略された場合には明示的に有効化
      contextIsolation:
        browserWindowOptions?.webPreferences?.contextIsolation ?? true,
      // セキュリティ強化のために nodeIntegration が省略された場合には明示的に無効化
      nodeIntegration:
        browserWindowOptions?.webPreferences?.nodeIntegration ?? false,
    },
  })

  // 作成後フックの呼び出し
  onCreated?.(win)

  /** --------------------------------------------------------------------------
   *
   * BrowserWindow イベントハンドリング
   *
   * ------------------------------------------------------------------------ */

  /**
   * ウインドウがクローズされようとするときに発生します。
   *
   * https://www.electronjs.org/ja/docs/latest/api/browser-window#%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88-close
   */
  win.on('close', () => {
    onClose?.(win)
  })

  /**
   * ウインドウが閉じられたときに発生します。
   *
   * このイベントを受け取った後は、ウインドウへの参照を削除し、
   * 以降そのウインドウを使用しないようにしてください。
   *
   * https://www.electronjs.org/ja/docs/latest/api/browser-window#%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88-closed
   */
  win.on('closed', () => {
    // win は既に破棄されているので渡せない
    onClosed?.()
  })

  /** --------------------------------------------------------------------------
   *
   * WebContents イベントハンドリング
   *
   * ------------------------------------------------------------------------ */

  /**
   * 右クリックメニュー（コンテキストメニュー）が開かれる直前に発行されます。
   *
   * https://www.electronjs.org/ja/docs/latest/api/web-contents#%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88-context-menu
   */
  win.webContents.on('context-menu', (_, params) => {
    const menu = createContextMenu(win.webContents)
    menu.popup({
      window: win,
      x: params.x,
      y: params.y,
    })
  })

  /**
   * ナビゲーションが終了した時、すなわち、タブのくるくるが止まったときや、
   * onload イベントが送られた後に、発行されます。
   *
   * https://www.electronjs.org/ja/docs/latest/api/web-contents#%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88-did-finish-load
   */
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('main-process-message', new Date().toLocaleString())
  })

  /** --------------------------------------------------------------------------
   *
   * Renderer ロード処理
   *
   * ------------------------------------------------------------------------ */

  await loadRenderer(win)
}
