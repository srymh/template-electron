import { randomUUID } from 'node:crypto'

import { createAppAssetUrl } from '../core/app-asset-url'
import type { AppAssetFileResolver, AppAssetRootRegistry } from '../core/root-registry'

export type ExpiringAppAssetPublications = {
  publish: (options: {
    basePath: string
    expiresAt: number
    resolveFile: AppAssetFileResolver
  }) => {
    createUrl: (relativePath: string, searchParams?: Readonly<Record<string, string>>) => string
  }
  clearExpired: () => void
  dispose: () => void
}

/** provider-backed app-asset rootを期限付きで登録・解除する。 */
export function createExpiringAppAssetPublications(options: {
  roots: AppAssetRootRegistry
  rootIdPrefix: string
  now?: () => number
  createId?: () => string
}): ExpiringAppAssetPublications {
  const now = options.now ?? Date.now
  const createId = options.createId ?? randomUUID
  const publications = new Map<string, number>()

  const clearExpired = () => {
    const currentTime = now()
    for (const [rootId, expiresAt] of publications) {
      if (expiresAt > currentTime) continue
      options.roots.unregister(rootId)
      publications.delete(rootId)
    }
  }

  return {
    publish: ({ basePath, expiresAt, resolveFile }) => {
      clearExpired()
      const rootId = `${options.rootIdPrefix}${createId()}`
      options.roots.register({
        id: rootId,
        basePath,
        resolution: 'provider',
        cacheControl: 'no-store',
        resolveFile: (relativePath, searchParams) => {
          if (now() >= expiresAt) return null
          return resolveFile(relativePath, searchParams)
        },
      })
      publications.set(rootId, expiresAt)
      return {
        createUrl: (relativePath, searchParams) =>
          createAppAssetUrl({ rootId, relativePath, searchParams }),
      }
    },
    clearExpired,
    dispose: () => {
      for (const rootId of publications.keys()) options.roots.unregister(rootId)
      publications.clear()
    },
  }
}
