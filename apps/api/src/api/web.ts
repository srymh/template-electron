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

export function getWebApi<TKey>(
  getContext: (key: TKey) => WebContext,
): WithCallerKeyApi<WebApi, TKey> {
  return {
    findInPage: async ({ text }, key) => getContext(key).getWebContents().findInPage(text),
    stopFindInPage: async ({ action }, key) =>
      getContext(key).getWebContents().stopFindInPage(action),
    on: {
      blur: (listener, key) => {
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
      focus: (listener, key) => {
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
      foundInPage: (listener, key) => {
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
