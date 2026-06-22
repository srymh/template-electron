import type { AuthRuntime, AuthStatus } from '@repo/auth'
import type { ApiInterface, WithCallerKeyApi } from '@repo/ipc'

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

export function getAuthApi<TKey>(
  getContext: (key: TKey) => AuthContext,
): WithCallerKeyApi<AuthApi, TKey> {
  return {
    getStatus: async (key) => {
      return getContext(key).getRuntime().getStatus()
    },

    login: async (username, password, key) => {
      return getContext(key).getRuntime().login(username, password)
    },

    logout: async (key) => {
      getContext(key).getRuntime().logout()
    },
  }
}
