import path from 'node:path'

/**
 *
 * -----------------------------------------------------------------------------
 * DEV時のディレクトリ構成
 *
 * ```
 * $root/
 * ├─ package.json
 * ├─ dist-electron/
 * │   ├─ main/
 * │   │   └─ index.js
 * │   └─ preload/
 * │       └─ index.mjs
 * ├─ public/
 * └─ data/
 * ```
 *
 * ※ dist は参照しない
 *
 * ```
 * {
 *   appRoot:       '$root',
 *   mainDist:      '$root/dist-electron',
 *   rendererDist:  '',
 *   vitePublic:    '$root/public',
 *   preloadPath:   '$root/dist-electron/preload/index.mjs',
 *   indexHtmlPath: '',
 *   dataPath:      '$root/data'
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
 *    │    ├─ dist-electron/
 *    │    │   ├─ main/
 *    │    │   │   └─ index.js
 *    │    │   └─ preload/
 *    │    │       └─ index.mjs
 *    │    └─ dist/
 *    │        └─ index.html
 *    └─ data/
 * ```
 *
 * ```
 * {
 *   appRoot:       '$root/resources/app.asar',
 *   mainDist:      '$root/resources/app.asar/dist-electron',
 *   rendererDist:  '$root/resources/app.asar/dist',
 *   vitePublic:    '$root/resources/app.asar/dist',
 *   preloadPath:   '$root/resources/app.asar/dist-electron/preload/index.mjs',
 *   indexHtmlPath: '$root/resources/app.asar/dist/index.html',
 *   dataPath:      '$root/resources/data'
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
 *    │    ├─ dist-electron/
 *    │    │   ├─ main/
 *    │    │   │   └─ index.js
 *    │    │   └─ preload/
 *    │    │       └─ index.mjs
 *    │    └─ dist/
 *    │        └─ index.html
 *    └─ data/
 * ```
 *
 * ```
 * {
 *   appRoot:       '$root/resources/app',
 *   mainDist:      '$root/resources/app/dist-electron',
 *   rendererDist:  '$root/resources/app/dist',
 *   vitePublic:    '$root/resources/app/dist',
 *   preloadPath:   '$root/resources/app/dist-electron/preload/index.mjs',
 *   indexHtmlPath: '$root/resources/app/dist/index.html',
 *   dataPath:      '$root/resources/data'
 * }
 * ```
 */

/**
 * Electron main process 用のパス解決ユーティリティ。
 *
 * - このモジュールは「パスの計算のみ」を行い、副作用（`process.env` の変更など）は行いません。
 * - 呼び出し側（通常は `electron/main/index.ts`）で `process.env` へ反映してください。
 */
export type MainPaths = {
  /** アプリのルートディレクトリ（`dist` / `dist-electron` の親） */
  appRoot: string
  /** Electron main のビルド成果物ディレクトリ（例: `dist-electron`） */
  mainDist: string
  /** Renderer のビルド成果物ディレクトリ（例: `dist`） */
  rendererDist: string
  /** Vite public 参照用のディレクトリ（dev: `public`, prod: `dist`） */
  vitePublic: string
  /** preload スクリプトのパス（例: `dist-electron/preload/index.mjs`） */
  preloadPath: string
  /** Renderer のエントリ HTML のパス（例: `dist/index.html`） */
  indexHtmlPath: string
  /** data */
  dataPath: string
}

/**
 * Electron main 用の主要パスを解決します。
 *
 * 重要:
 * - 返す値は絶対パスです。
 * - ここでは `process.env` の変更は行いません。
 *
 * @param args.dirname `electron/main/index.ts` における `__dirname` 相当
 * @param args.viteDevServerUrl 開発時の Vite dev server URL（prod では `undefined`）
 * @returns main/renderer/preload 等で利用するパス一式
 */
export function resolveMainPaths(args: {
  isPackaged: boolean
  /** Equivalent to `path.dirname(fileURLToPath(import.meta.url))` in `electron/main/index.ts` */
  dirname: string
}): MainPaths {
  const { isPackaged: isProd, dirname } = args

  const appRoot = path.join(dirname, '..', '..')

  const mainDist = path.join(appRoot, 'dist-electron')
  const preloadPath = path.join(mainDist, 'preload', 'index.mjs')

  const rendererDist = isProd
    ? path.join(appRoot, 'dist')
    : // DEV時には使用しない
      ''

  const vitePublic = isProd ? rendererDist : path.join(appRoot, 'public')
  const indexHtmlPath = isProd
    ? path.join(rendererDist, 'index.html')
    : // DEV時には使用しない
      ''

  const dataPath = isProd
    ? path.join(process.resourcesPath, 'data')
    : path.join(appRoot, 'data')

  return {
    appRoot,
    mainDist,
    rendererDist,
    vitePublic,
    preloadPath,
    indexHtmlPath,
    dataPath,
  }
}
