import crypto from 'node:crypto'
import fs from 'node:fs/promises'

import { createAppAssetUrlFromFilePath } from '@repo/asset-protocol'
import type { FileSystemContext } from '@your-app-name/api/fs'

import type { DesktopFeatureFactory } from '../app/feature'

const USER_DIRECTORY_ROOT_PREFIX = 'user-dir-'

/**
 * windowごとにapp-assetのrootを登録する機能を作成する。
 * 登録はwindowの閉鎖時とアプリ終了時の早い方で解除する。
 * @param host - app-assetのregistryと終了処理の能力
 * @returns 登録の所有者となるwindowごとのcontextを生成する機能
 */
export const createFileSystemFeature: DesktopFeatureFactory<FileSystemContext> = ({
  appRuntime,
}) => ({
  createWindowContext: ({ win }) => {
    const registeredRootIds = new Set<string>()
    let disposed = false

    const unregisterAll = () => {
      if (disposed) return
      disposed = true

      for (const rootId of registeredRootIds) {
        appRuntime.appAssetRoots.unregister(rootId)
      }
      registeredRootIds.clear()
    }

    win.once('closed', unregisterAll)
    appRuntime.addDispose(unregisterAll)

    return {
      registerAppAssetDirectory: async ({ path }) => {
        const basePath = await fs.realpath(path)
        const stats = await fs.stat(basePath)
        if (!stats.isDirectory()) {
          throw new Error(`App asset root must be a directory: ${path}`)
        }

        const rootId = createUserDirectoryRootId()
        appRuntime.appAssetRoots.register({
          id: rootId,
          basePath,
          resolution: 'directory',
        })
        registeredRootIds.add(rootId)

        return {
          rootId,
          basePath,
        }
      },
      unregisterAppAssetRoot: async ({ rootId }) => {
        if (!registeredRootIds.has(rootId)) {
          return false
        }

        registeredRootIds.delete(rootId)
        return appRuntime.appAssetRoots.unregister(rootId)
      },
      createAppAssetUrl: async ({ rootId, path }) => {
        if (!registeredRootIds.has(rootId)) {
          throw new Error(`App asset root is not registered for this window: ${rootId}`)
        }

        const filePath = await fs.realpath(path)
        return createAppAssetUrlFromFilePath(
          {
            rootId,
            filePath,
          },
          appRuntime.appAssetRoots,
        )
      },
    }
  },
})

function createUserDirectoryRootId(): string {
  return `${USER_DIRECTORY_ROOT_PREFIX}${crypto.randomUUID()}`
}
