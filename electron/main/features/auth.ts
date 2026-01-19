import type { WebContents } from 'electron'

import type { ApiInterface, WithWebContentsApi } from '../lib/ipc'
import type { AuthRuntime } from '../services/auth/authRuntime'
import type { AuthStatus } from '../services/auth/authService'

// -----------------------------------------------------------------------------
// 型定義

export const AUTH_API_KEY = 'auth' as const
export type AuthApiKey = typeof AUTH_API_KEY

export type AuthContext = {
  getRuntime: () => AuthRuntime
}

// -----------------------------------------------------------------------------
// インターフェイス定義

export type AuthApi = ApiInterface<{
  getStatus: () => Promise<AuthStatus>
  login: (username: string, password: string) => Promise<AuthStatus>
  logout: () => Promise<void>
}>

// -----------------------------------------------------------------------------
// 実装

export function getAuthApi(
  getContext: (webContents: WebContents) => AuthContext,
): WithWebContentsApi<AuthApi> {
  return {
    getStatus: async (webContents) => {
      return getContext(webContents).getRuntime().getStatus()
    },

    login: async (username, password, webContents) => {
      return getContext(webContents).getRuntime().login(username, password)
    },

    logout: async (webContents) => {
      getContext(webContents).getRuntime().logout()
    },
  }
}
