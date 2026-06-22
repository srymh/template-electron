import path from 'node:path'

/**
 *
 * -----------------------------------------------------------------------------
 * DEV時のディレクトリ構成
 *
 * ```
 * $root/
 * ├─ package.json
 * ├─ dist/
 * │   ├─ main/
 * │   │   └─ index.js
 * │   └─ preload/
 * │       └─ index.cjs
 * ├─ public/
 * └─ data/
 * ```
 *
 * ※ dist は参照しない
 *
 * ```
 * {
 *   appRoot:       '$root',
 *   mainDist:      '$root/dist',
 *   rendererDist:  '',
 *   desktopPublic: '$root/public',
 *   vitePublic:    '$root/public',
 *   preloadPath:   '$root/dist/preload/index.cjs',
 *   indexHtmlPath: '',
 *   dataPath:      '$root/data',
 *   userDataPath:  'C:\\Users\\ユーザー名\\AppData\\Roaming\\your-app-name\\app' (Windowsの場合)
 *   userDataPath:  '/Users/ユーザー名/Library/Application Support/your-app-name/app' (macOSの場合)
 * }
 * ```
 *
 * -----------------------------------------------------------------------------
 * PROD時のディレクトリ構成(asar有効の場合)
 *
 * ```
 * $root/
 * └─ resources/
 *    ├─ app.asar
 *    │    ├─ dist/
 *    │    │   ├─ main/
 *    │    │   │   └─ index.js
 *    │    │   └─ preload/
 *    │    │       └─ index.cjs
 *    │    └─ web/dist/
 *    │            └─ index.html
 *    └─ data/
 * ```
 *
 * ```
 * {
 *   appRoot:       '$root/resources/app.asar',
 *   mainDist:      '$root/resources/app.asar/dist',
 *   rendererDist:  '$root/resources/app.asar/web/dist',
 *   desktopPublic: '$root/resources/app.asar/public',
 *   vitePublic:    '$root/resources/app.asar/web/dist',
 *   preloadPath:   '$root/resources/app.asar/dist/preload/index.cjs',
 *   indexHtmlPath: '$root/resources/app.asar/web/dist/index.html',
 *   dataPath:      '$root/resources/data',
 *   userDataPath:  'C:\\Users\\ユーザー名\\AppData\\Roaming\\your-app-name\\app' (Windowsの場合)
 *   userDataPath:  '/Users/ユーザー名/Library/Application Support/your-app-name/app' (macOSの場合)
 * }
 * ```
 *
 * -----------------------------------------------------------------------------
 * PROD時のディレクトリ構成(asar無効の場合)
 *
 * ```
 * $root/
 * └─ resources/
 *    ├─ app/
 *    │    ├─ dist/
 *    │    │   ├─ main/
 *    │    │   │   └─ index.js
 *    │    │   └─ preload/
 *    │    │       └─ index.cjs
 *    │    └─ web/dist/
 *    │            └─ index.html
 *    └─ data/
 * ```
 *
 * ```
 * {
 *   appRoot:       '$root/resources/app',
 *   mainDist:      '$root/resources/app/dist',
 *   rendererDist:  '$root/resources/app/web/dist',
 *   desktopPublic: '$root/resources/app/public',
 *   vitePublic:    '$root/resources/app/web/dist',
 *   preloadPath:   '$root/resources/app/dist/preload/index.cjs',
 *   indexHtmlPath: '$root/resources/app/web/dist/index.html',
 *   dataPath:      '$root/resources/data',
 *   userDataPath:  'C:\\Users\\ユーザー名\\AppData\\Roaming\\your-app-name\\app' (Windowsの場合)
 *   userDataPath:  '/Users/ユーザー名/Library/Application Support/your-app-name/app' (macOSの場合)
 * }
 * ```
 */

/**
 * Electron main process 用のパス解決ユーティリティ。
 *
 * - このモジュールは「パスの計算のみ」を行い、副作用（`process.env` の変更など）は行いません。
 * - 呼び出し側（通常は `src/main/index.ts`）で `process.env` へ反映してください。
 */
export type MainPaths = {
  /** アプリのルートディレクトリ（`web/dist` / `dist` の親） */
  appRoot: string
  /** Electron main のビルド成果物ディレクトリ（例: `dist`） */
  mainDist: string
  /** Renderer のビルド成果物ディレクトリ（例: `web/dist`） */
  rendererDist: string
  /** Desktop 側の public assets ディレクトリ（例: `public`） */
  desktopPublic: string
  /** Vite public 参照用のディレクトリ（dev: `public`, prod: `web/dist`） */
  vitePublic: string
  /** preload スクリプトのパス（例: `dist/preload/index.cjs`） */
  preloadPath: string
  /** Renderer のエントリ HTML のパス（例: `web/dist/index.html`） */
  indexHtmlPath: string
  /** ビルトインの読み取り用データディレクトリ */
  dataPath: string
  /** ユーザーデータ用ディレクトリ */
  userDataPath: string
}

/**
 * Electron main 用の主要パスを解決します。
 *
 * 重要:
 * - 返す値は絶対パスです。
 * - ここでは `process.env` の変更は行いません。
 *
 * @param args.dirname `src/main/index.ts` における `__dirname` 相当
 * @param args.viteDevServerUrl 開発時の Vite dev server URL（prod では `undefined`）
 * @returns main/renderer/preload 等で利用するパス一式
 */
export function resolveMainPaths(args: {
  isPackaged: boolean
  /** Equivalent to `path.dirname(fileURLToPath(import.meta.url))` in `src/main/index.ts` */
  dirname: string
  userDataPath: string
}): MainPaths {
  const { isPackaged: isProd, dirname, userDataPath } = args

  const appRoot = path.join(dirname, '..', '..')

  const mainDist = path.join(appRoot, 'dist')
  const preloadPath = path.join(mainDist, 'preload', 'index.cjs')

  const rendererDist = isProd
    ? path.join(appRoot, 'web', 'dist')
    : // DEV時には使用しない
      ''

  const desktopPublic = path.join(appRoot, 'public')
  const vitePublic = isProd ? rendererDist : path.join(appRoot, 'public')
  const indexHtmlPath = isProd
    ? path.join(rendererDist, 'index.html')
    : // DEV時には使用しない
      ''

  const dataPath = isProd ? path.join(process.resourcesPath, 'data') : path.join(appRoot, 'data')

  const userDataPathResolved = path.join(userDataPath, 'app')

  return {
    appRoot,
    mainDist,
    rendererDist,
    desktopPublic,
    vitePublic,
    preloadPath,
    indexHtmlPath,
    dataPath,
    userDataPath: userDataPathResolved,
  }
}

export function getAppIconPath(publicPath: string) {
  return path.join(publicPath, process.platform === 'darwin' ? 'app.icns' : 'app.ico')
}

/**
 * file://... のパスに必ず末尾セパレータをつける関数
 * 例: input: file:///path/to/dist -> output: file:///path/to/dist/
 * @param p パス
 * @returns 末尾セパレータ付きのパス
 */
export function ensureTrailingSeparator(p: string) {
  return p.endsWith(path.sep) ? p : p + path.sep
}
