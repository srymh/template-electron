import path from 'node:path'

import type { KakeiboContext } from '@your-app-name/api/kakeibo'

import { createAppDatabase } from '../infra/db'
import type { CreateApiContext } from './types'

export const createKakeiboContext: CreateApiContext<KakeiboContext> = ({
  appRuntime,
  appContext,
}) => {
  return {
    getDb: () => {
      const db = appContext.db
      if (db) {
        return db
      }

      try {
        const db = createAppDatabase(path.join(appRuntime.paths.dataPath, 'kakeibo.db'), {
          readonly: false,
          fileMustExist: false,
        })
        appContext.db = db
        appRuntime.addDispose(() => {
          db.close()
          console.log(`[DB] Database connection closed`)
        })
        console.log(`[DB] Database opened successfully at kakeibo.db`)
      } catch (error) {
        console.error('[DB] Failed to open database:', error)
        throw error
      }
      return appContext.db
    },
  }
}
