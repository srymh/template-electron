import type { Event, Result, WebContents } from 'electron'

import type { ApiInterface, AddListener, WithCallerKeyApi } from '@repo/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const WEB_API_KEY = 'web' as const
export type WebApiKey = typeof WEB_API_KEY

export type WebContext = {
  getWebContents: () => WebContents
}

// -----------------------------------------------------------------------------
// インターフェイス定義

export type WebApi = ApiInterface<{
  findInPage: (options: { text: string }) => Promise<number>
  stopFindInPage: (options: {
    action: Parameters<WebContents['stopFindInPage']>[0]
  }) => Promise<void>
  on: {
    blur: AddListener<void>
    focus: AddListener<void>
    foundInPage: AddListener<Result>
  }
}>

// -----------------------------------------------------------------------------
// 実装

/**
 * 呼び出し元キーを受け取って各操作を返すWebContents 操作 API を構成する。
 * @param getContext - 呼び出し元キーに対応する context を取得する関数
 * @returns 各操作をキーに対応する context へ接続する API
 */
export function getWebApi<TKey>(
  getContext: (key: TKey) => WebContext,
): WithCallerKeyApi<WebApi, TKey> {
  return {
    findInPage:
      (key) =>
      async ({ text }) =>
        getContext(key).getWebContents().findInPage(text),
    stopFindInPage:
      (key) =>
      async ({ action }) =>
        getContext(key).getWebContents().stopFindInPage(action),
    on: {
      blur: (key) => (listener) => {
        const webContents = getContext(key).getWebContents()
        const listenerWrapper = () => listener()
        webContents.on('blur', listenerWrapper)
        let disposed = false
        return () => {
          if (disposed) return
          disposed = true
          webContents.off('blur', listenerWrapper)
        }
      },
      focus: (key) => (listener) => {
        const webContents = getContext(key).getWebContents()
        const listenerWrapper = () => listener()
        webContents.on('focus', listenerWrapper)
        let disposed = false
        return () => {
          if (disposed) return
          disposed = true
          webContents.off('focus', listenerWrapper)
        }
      },
      foundInPage: (key) => (listener) => {
        const webContents = getContext(key).getWebContents()
        const listenerWrapper = (_: Event, result: Result) => {
          listener(result)
        }
        webContents.on('found-in-page', listenerWrapper)
        let disposed = false
        return () => {
          if (disposed) return
          disposed = true
          webContents.off('found-in-page', listenerWrapper)
        }
      },
    },
  }
}
