import path from 'node:path'

import { createAuthRuntime } from '@repo/auth'
import type { Database } from '@repo/sqlite'
import type { AuthContext } from '@your-app-name/api/auth'

import { createAppDatabase } from '../infra/db'
import type { CreateApiContext } from './types'

export const createAuthContext: CreateApiContext<AuthContext> = ({ appRuntime, appContext }) => {
  return {
    getRuntime: () => {
      const runtime = appContext.authRuntime
      if (runtime) {
        return runtime
      }

      /**
       * desktop app 用に auth.db の実体を開く factory。
       * 認証スキーマ初期化は @repo/auth 側で行う。
       */
      function createAuthDb(): Database {
        const dbPath = path.join(appRuntime.paths.userDataPath, 'auth.db')

        console.log(`Auth DB Path: ${dbPath}`)

        return createAppDatabase(dbPath)
      }

      const newRuntime = createAuthRuntime({
        createDb: createAuthDb,
      })
      appContext.authRuntime = newRuntime
      appRuntime.addDispose(() => newRuntime.dispose())
      return newRuntime
    },
  }
}
