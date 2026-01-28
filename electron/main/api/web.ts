import type { Event, Result } from 'electron'
import type {
  ApiInterface,
  AddListener,
  WithWebContentsApi,
} from '#/shared/lib/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const WEB_API_KEY = 'web' as const
export type WebApiKey = typeof WEB_API_KEY

// -----------------------------------------------------------------------------
// インターフェイス定義

export type WebApi = ApiInterface<{
  findInPage: (options: { text: string }) => Promise<number>
  stopFindInPage: (options: {
    action: Parameters<Electron.WebContents['stopFindInPage']>[0]
  }) => Promise<void>
  on: {
    blur: AddListener<void>
    focus: AddListener<void>
    foundInPage: AddListener<Result>
  }
}>

// -----------------------------------------------------------------------------
// 実装

export function getWebApi(): WithWebContentsApi<WebApi> {
  return {
    findInPage: async ({ text }, webContents) => webContents.findInPage(text),
    stopFindInPage: async ({ action }, webContents) =>
      webContents.stopFindInPage(action),
    on: {
      blur: (listener, webContents) => {
        const listenerWrapper = () => listener()
        webContents.on('blur', listenerWrapper)
        let disposed = false
        return () => {
          if (disposed) return
          disposed = true
          webContents.off('blur', listenerWrapper)
        }
      },
      focus: (listener, webContents) => {
        const listenerWrapper = () => listener()
        webContents.on('focus', listenerWrapper)
        let disposed = false
        return () => {
          if (disposed) return
          disposed = true
          webContents.off('focus', listenerWrapper)
        }
      },
      foundInPage: (listener, webContents) => {
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
