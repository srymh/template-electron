import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { registerIpc } from '@your-app-name/api/main'

import type { AppRuntime } from './app/app-runtime'
import { createApiFeature } from './app/create-api-feature'
import { createAppRuntime } from './app/create-app-runtime'
import { startApp } from './app/startApp'
import { getAppIconPath } from './infra/paths'
import {
  registerCustomProtocol,
  registerCustomProtocolPrivileges,
} from './infra/registerCustomProtocol'
import { ApiContextRegistry } from './ipc/context-registry'
import { createTitleBarOverlay } from './windows/create-title-bar-overlay'
import { createWindow, recommendedSecureOptions } from './windows/createWindow'

/** __dirname の代替 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 開発時の Vite dev server URL */
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// -----------------------------------------------------------------------------
// app 準備前の処理

registerCustomProtocolPrivileges()

// -----------------------------------------------------------------------------
// app 起動処理

const appRuntime = await createAppRuntime({
  dirname: __dirname,
  devServerUrl: VITE_DEV_SERVER_URL,
})

const apiFeature = createApiFeature({ appRuntime })
const apiContexts = new ApiContextRegistry()

startApp({
  appRuntime,
  /** --------------------------------------------------------------------------
   *
   * app 準備完了後の処理
   *
   * ------------------------------------------------------------------------ */
  onAppReady: async ({ appRuntime }) => {
    // カスタムプロトコルの登録
    registerCustomProtocol(appRuntime.appAssetRoots, {
      onInternalError: (error, context) => {
        appRuntime.logger.error('[app-asset] provider failed:', context, error)
      },
    })

    // IPC登録（window が load して renderer が invoke する前に必ず登録しておく）
    registerIpc({
      getContext: (webContents) => {
        return apiContexts.getOrThrow(webContents)
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
      logger: appRuntime.logger,
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
        const apiContext = apiFeature.createWindowContext({ win })
        unregisterWindow = appRuntime.registerWindow(win)
        unregisterWindowContext = apiContexts.register(win.webContents, apiContext)
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
