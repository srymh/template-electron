import type { WebContents } from 'electron'
import type { DataBase } from '../features/db/db'
import type { ApiInterface, WithWebContentsApi } from '#/shared/lib/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const Kakeibo_API_KEY = 'kakeibo' as const
export type KakeiboApiKey = typeof Kakeibo_API_KEY

export type KakeiboContext = {
  getDb: () => DataBase
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

export function getKakeiboApi(
  getContext: (webContents: WebContents) => KakeiboContext,
): WithWebContentsApi<KakeiboApi> {
  return {
    entries: async (wc) => {
      const db = getContext(wc).getDb()

      const entries = db.query(
        'SELECT * FROM expense_view ORDER BY spent_at DESC;',
      )

      return entries as KakeiboEntry[]
    },
  }
}
