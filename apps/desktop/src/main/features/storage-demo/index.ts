import { openNodeDatabase } from '@repo/sqlite/node'
import type { StorageDemoContext } from '@your-app-name/api/storage-demo'

import type { DesktopFeatureFactory } from '../../app/feature'
import { createStorageDemoRuntime, resolveStorageDemoStoragePaths } from './runtime'
import type { StorageDemoRuntime } from './runtime'

/**
 * window 間で共有する保存機能デモの runtime を遅延作成する機能を作成する。
 * 作成時には runtime も DB も作らない。
 * @param host - 保存先・配信・終了処理の能力
 * @returns window ごとに service の取得窓口を生成する機能
 */
export const createStorageDemoFeature: DesktopFeatureFactory<StorageDemoContext> = ({
  appRuntime,
}) => {
  let sharedRuntime: StorageDemoRuntime | null = null

  /**
   * window 間で共有する runtime を取得し、未作成なら作成する。
   * @returns アプリ終了時に破棄される runtime
   */
  const getRuntime = () => {
    if (!sharedRuntime) {
      const runtime = createStorageDemoRuntime({
        paths: resolveStorageDemoStoragePaths(appRuntime.paths.appDataPath),
        openDatabase: (filePath, connection) =>
          openNodeDatabase(filePath, {
            connection: { busyTimeoutMs: 5000, ...connection },
          }),
        objectDeliveryRegistry: appRuntime.appAssetRoots,
      })

      sharedRuntime = runtime
      appRuntime.addDispose(() => runtime.dispose())
    }

    return sharedRuntime
  }

  return {
    createWindowContext: () => ({
      getService: () => getRuntime().getService(),
    }),
  }
}
