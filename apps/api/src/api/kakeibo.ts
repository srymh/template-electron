import type { ApiInterface, WithCallerKeyApi } from '@repo/ipc'
import type { Database } from '@repo/sqlite'

// -----------------------------------------------------------------------------
// 型定義

export const Kakeibo_API_KEY = 'kakeibo' as const
export type KakeiboApiKey = typeof Kakeibo_API_KEY

export type KakeiboContext = {
  getDb: () => Database
}

export type KakeiboEntry = {
  id: number
  spent_at: string
  amount: number
  user: string
  category: string
  payment_method: string
}

// -----------------------------------------------------------------------------
// インターフェイス定義

export type KakeiboApi = ApiInterface<{
  entries: () => Promise<KakeiboEntry[]>
}>

// -----------------------------------------------------------------------------
// 実装

export function getKakeiboApi<TKey>(
  getContext: (key: TKey) => KakeiboContext,
): WithCallerKeyApi<KakeiboApi, TKey> {
  return {
    entries: async (key) => {
      const db = getContext(key).getDb()

      const entries = db.query('SELECT * FROM expense_view ORDER BY spent_at DESC;')

      return entries as KakeiboEntry[]
    },
  }
}
