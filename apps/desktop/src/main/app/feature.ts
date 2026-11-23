import type { BrowserWindow } from 'electron'

import type { AppRuntime } from './app-runtime'

/** アプリ単位の機能構築に渡す実行環境能力。機能固有の状態は持たせない。 */
export type AppHost = {
  appRuntime: AppRuntime
}

/** window単位のcontext構築に渡す実行環境能力。 */
export type WindowHost = {
  win: BrowserWindow
}

/** アプリ単位で存在し、windowごとのAPI contextを生成する機能。 */
export type DesktopFeature<TContext> = {
  /**
   * windowのAPI contextを作成する。window作成時に一度だけ呼ばれる。
   * @param host - 対象windowの能力
   * @returns そのwindowのIPCが使い続けるcontext
   */
  createWindowContext: (host: WindowHost) => TContext
}

/**
 * アプリの実行環境能力から機能を生成する共通契約。
 * アプリ構成につき一度だけ呼ばれ、DB接続や配信登録などの副作用は行わない。
 * @param host - アプリ単位の実行環境能力
 * @returns アプリ共有の状態を内部に保持する機能
 */
export type DesktopFeatureFactory<TContext> = (host: AppHost) => DesktopFeature<TContext>
