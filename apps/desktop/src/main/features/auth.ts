import path from 'node:path'

import { createAuthRuntime } from '@repo/auth'
import type { AuthRuntime } from '@repo/auth'
import type { Database } from '@repo/sqlite'
import { openNodeDatabase } from '@repo/sqlite/node'
import type { AuthContext } from '@your-app-name/api/auth'

import type { DesktopFeatureFactory } from '../app/feature'

/**
 * window間で共有する認証runtimeを遅延作成する機能を作成する。
 * @param host - 保存先と終了処理の能力
 * @returns windowごとにruntimeの取得窓口を生成する機能
 */
export const createAuthFeature: DesktopFeatureFactory<AuthContext> = ({ appRuntime }) => {
  let sharedRuntime: AuthRuntime | null = null

  const getRuntime = () => {
    if (sharedRuntime) {
      return sharedRuntime
    }

    /**
     * desktop app 用に auth.db の実体を開く factory。
     * 認証スキーマ初期化は @repo/auth 側で行う。
     * @returns runtimeが解放する接続。ロック待機は5秒
     * @throws 接続や設定に失敗した場合
     */
    function createAuthDb(): Database {
      const dbPath = path.join(appRuntime.paths.electronDataPath, 'auth.db')

      console.log(`Auth DB Path: ${dbPath}`)

      return openNodeDatabase(dbPath, { connection: { busyTimeoutMs: 5000 } })
    }

    const newRuntime = createAuthRuntime({
      createDb: createAuthDb,
    })
    sharedRuntime = newRuntime
    appRuntime.addDispose(() => newRuntime.dispose())
    return newRuntime
  }

  return {
    createWindowContext: () => ({ getRuntime }),
  }
}
