import { createAppDataBase } from '../features/db/db'

import type { WebContents } from 'electron'
import type { DataBase } from '../features/db/db'
import type { ApiInterface, WithWebContentsApi } from '../lib/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const Kakeibo_API_KEY = 'kakeibo' as const
export type KakeiboApiKey = typeof Kakeibo_API_KEY

export type KakeiboContext = {
  getDb: () => DataBase | null
  setDb: (db: DataBase | null) => void
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
    entries: async (webContents) => {
      const { getDb, setDb } = getContext(webContents)
      let db = getDb()

      if (!db) {
        console.log(`[DB] Opening database at kakeibo.db`)
        try {
          db = createAppDataBase('kakeibo.db', {
            readonly: true, // 読み取り専用で開く
            fileMustExist: true, // DB ファイルが存在しない場合はエラー
          })
          setDb(db)
          console.log(`[DB] Database opened successfully at kakeibo.db`)
        } catch (error) {
          console.error('[DB] Failed to open database:', error)
          throw new Error('[DB] Database initialization failed')
        }
      }

      const entries = db.query(
        'SELECT * FROM expense_view ORDER BY spent_at DESC;',
      )

      return entries as KakeiboEntry[]
    },
  }
}
