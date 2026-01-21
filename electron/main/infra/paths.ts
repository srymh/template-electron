import path from 'node:path'

/**
 * @todo DEV時のディレクトリ構成
 * @todo PROD時のディレクトリ構成
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
  /** ウィンドウアイコンのパス */
  iconPath: string
  /** Renderer のエントリ HTML のパス（例: `dist/index.html`） */
  indexHtmlPath: string

  /** @todo Dataフォルダのパス */
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
  /** Equivalent to `path.dirname(fileURLToPath(import.meta.url))` in `electron/main/index.ts` */
  dirname: string
  viteDevServerUrl: string | undefined
}): MainPaths {
  const appRoot = path.join(args.dirname, '..', '..')
  const mainDist = path.join(appRoot, 'dist-electron')
  const rendererDist = path.join(appRoot, 'dist')

  const vitePublic = args.viteDevServerUrl
    ? path.join(appRoot, 'public')
    : rendererDist

  return {
    appRoot,
    mainDist,
    rendererDist,
    vitePublic,
    preloadPath: path.join(args.dirname, '..', 'preload', 'index.mjs'),
    iconPath: path.join(vitePublic, 'favicon.ico'),
    indexHtmlPath: path.join(rendererDist, 'index.html'),
  }
}
