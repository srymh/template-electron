import type { WebContents } from 'electron'

import type { ApiInterface, WithWebContentsApi } from '../lib/ipc'
import type { DataBase } from '../services/db/db'
import {
  getAuthStatus,
  login as loginService,
  logout as logoutService,
} from '../services/auth/authService'
import type { AuthStatus } from '../services/auth/authService'

// -----------------------------------------------------------------------------
// 型定義

export const AUTH_API_KEY = 'auth' as const
export type AuthApiKey = typeof AUTH_API_KEY

export type AuthContext = {
  getDb: () => DataBase | null
  setDb: (db: DataBase | null) => void
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
      const db = getContext(webContents).getDb()
      if (!db) throw new Error('Auth DB is not initialized')
      return getAuthStatus(db)
    },

    login: async (username, password, webContents) => {
      const db = getContext(webContents).getDb()
      if (!db) throw new Error('Auth DB is not initialized')
      return loginService(db, username, password)
    },

    logout: async (webContents) => {
      const db = getContext(webContents).getDb()
      if (!db) throw new Error('Auth DB is not initialized')
      logoutService(db)
    },
  }
}
