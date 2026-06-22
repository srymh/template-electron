import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { registerIpc } from '@your-app-name/api/main'

import { createWindowApiContext } from './api'
import { createAppContext, createWindowState } from './app-context'
import type { AppRuntime } from './app/app-runtime'
import { createAppRuntime } from './app/create-app-runtime'
import { startApp } from './app/startApp'
import { getAppIconPath } from './infra/paths'
import { registerCustomProtocol } from './infra/registerCustomProtocol'
import { createTitleBarOverlay } from './windows/create-title-bar-overlay'
import { createWindow, recommendedSecureOptions } from './windows/createWindow'

/** __dirname の代替 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 開発時の Vite dev server URL */
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

const appRuntime = await createAppRuntime({
  dirname: __dirname,
  devServerUrl: VITE_DEV_SERVER_URL,
})

const appContext = await createAppContext()

startApp({
  appRuntime,
  /** --------------------------------------------------------------------------
   *
   * app 準備完了後の処理
   *
   * ------------------------------------------------------------------------ */
  onAppReady: async ({ appRuntime }) => {
    registerCustomProtocol()

    // IPC登録（window が load して renderer が invoke する前に必ず登録しておく）
    registerIpc({
      getContext: (webContents) => {
        return appContext.apiContexts.getOrThrow(webContents).apiContext
      },
      cache: appRuntime.registerIpcCache,
    })
  },
  openMainWindow,
})

function openMainWindow({ appRuntime }: { appRuntime: AppRuntime }) {
  let unregisterWindow: (() => void) | null = null
  let unregisterWindowContext: (() => void) | null = null

  createWindow(
    async (win) => {
      // Debug
      appRuntime.logger.info('-------------------------------------------------------------')
      appRuntime.logger.info('appRuntime.devServerUrl    :', appRuntime.devServerUrl)
      appRuntime.logger.info('appRuntime.rendererRootUrl :', appRuntime.rendererRootUrl)
      appRuntime.logger.info('appRuntime.paths.indexHtmlPath :', appRuntime.paths.indexHtmlPath)
      appRuntime.logger.info('-------------------------------------------------------------')

      if (appRuntime.devServerUrl) {
        await win.loadURL(appRuntime.devServerUrl)
      } else {
        await win.loadFile(appRuntime.paths.indexHtmlPath)
      }
    },
    {
      /** --------------------------------------------------------------------
       * BrowserWindow のオプション設定
       * ------------------------------------------------------------------ */
      browserWindowOptions: {
        icon: getAppIconPath(appRuntime.paths.desktopPublic),
        autoHideMenuBar: process.platform !== 'darwin',
        // タイトルバーを完全に消す
        titleBarStyle: 'hidden',
        // macOS 以外は titleBarOverlay を有効にしてタイトルバーとコンテンツを重ねる
        // https://www.electronjs.org/docs/latest/tutorial/custom-title-bar#add-native-window-controls-windows-linux
        ...(process.platform !== 'darwin' ? { titleBarOverlay: createTitleBarOverlay() } : {}),
        webPreferences: {
          ...recommendedSecureOptions,
          preload: appRuntime.paths.preloadPath,
        },
      },
      /** --------------------------------------------------------------------
       * ナビゲーションポリシー設定
       * ------------------------------------------------------------------ */
      navigation: {
        allowedDevOrigin: appRuntime.allowedDevOrigin,
        rendererRootUrl: appRuntime.rendererRootUrl,
      },
      /** --------------------------------------------------------------------
       * ライフサイクルフック
       * ------------------------------------------------------------------ */
      onCreated: (win) => {
        const windowState = createWindowState()
        const apiContext = createWindowApiContext({ win, appRuntime, windowState, appContext })
        unregisterWindow = appRuntime.registerWindow(win)
        unregisterWindowContext = appContext.apiContexts.register(win.webContents, {
          apiContext,
          state: windowState,
        })
      },
      onClosed: () => {
        unregisterWindowContext?.()
        unregisterWindowContext = null
        unregisterWindow?.()
        unregisterWindow = null
      },
    },
  ).catch((err) => {
    console.error(`Failed to create main window: ${String(err)}`)
  })
}
