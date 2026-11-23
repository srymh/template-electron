import path from 'node:path'

import { resolvePathInsideRoot } from './path-safety'

type AppAssetRootOptions = {
  /** URL の host 部分に使う root ID。 */
  id: string
  /** true の場合、既定の Cache-Control を immutable にする。 */
  immutable?: boolean
  /** root ごとの Cache-Control。指定すると immutable より優先される。 */
  cacheControl?: string
}

export type AppAssetRootInput = AppAssetRootOptions &
  (
    | { resolution: 'directory'; basePath: string; resolveFile?: never; resolveStream?: never }
    | {
        resolution: 'provider'
        basePath: string
        resolveFile: AppAssetFileResolver
        resolveStream?: never
      }
    | {
        resolution: 'stream'
        basePath?: never
        resolveFile?: never
        resolveStream: AppAssetStreamResolver
      }
  )

type AppAssetRootBase = {
  id: string
  cacheControl: string
}

export type AppAssetRoot = AppAssetRootBase &
  (
    | { resolution: 'directory' | 'provider'; basePath: string; resolveFile: AppAssetFileResolver }
    | { resolution: 'stream'; resolveStream: AppAssetStreamResolver }
  )

export type AppAssetResolvedFile = {
  filePath: string
  mediaType?: string
}

export type AppAssetFileResolver = (
  relativePath: string,
  searchParams: URLSearchParams,
) => Promise<AppAssetResolvedFile | null> | AppAssetResolvedFile | null

export type AppAssetResolvedStream = {
  byteSize: number
  mediaType: string
  read: (range: { offset: number; length: number }) => Promise<AsyncIterable<Uint8Array>>
}

export type AppAssetStreamResolver = (
  relativePath: string,
  searchParams: URLSearchParams,
) => Promise<AppAssetResolvedStream | null> | AppAssetResolvedStream | null

const APP_ASSET_ROOT_ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const DEFAULT_CACHE_CONTROL = 'no-store'

/** app-asset://<rootId>/... の namespace と公開方法を管理する。 */
export class AppAssetRootRegistry {
  private readonly roots = new Map<string, AppAssetRoot>()

  constructor(roots: readonly AppAssetRootInput[] = []) {
    for (const root of roots) this.register(root)
  }

  register(input: AppAssetRootInput): AppAssetRoot {
    validateAppAssetRootId(input.id)
    const common = {
      id: input.id,
      cacheControl:
        input.cacheControl ??
        (input.immutable === true ? IMMUTABLE_CACHE_CONTROL : DEFAULT_CACHE_CONTROL),
    }
    let root: AppAssetRoot
    if (input.resolution === 'stream') {
      root = { ...common, resolution: 'stream', resolveStream: input.resolveStream }
    } else {
      const basePath = path.resolve(input.basePath)
      root = {
        ...common,
        basePath,
        resolution: input.resolution,
        resolveFile:
          input.resolution === 'provider'
            ? input.resolveFile
            : (relativePath) => ({ filePath: resolvePathInsideRoot(basePath, relativePath) }),
      }
    }
    this.roots.set(root.id, root)
    return root
  }

  unregister(rootId: string): boolean {
    validateAppAssetRootId(rootId)
    return this.roots.delete(rootId)
  }

  get(rootId: string): AppAssetRoot | undefined {
    validateAppAssetRootId(rootId)
    return this.roots.get(rootId)
  }

  getOrThrow(rootId: string): AppAssetRoot {
    const root = this.get(rootId)
    if (!root) throw new Error(`Unsupported app asset root: ${rootId}`)
    return root
  }
}

export function createAppAssetRootRegistry(
  roots: readonly AppAssetRootInput[],
): AppAssetRootRegistry {
  return new AppAssetRootRegistry(roots)
}

export function validateAppAssetRootId(rootId: string): void {
  if (!rootId) throw new Error('App asset root id is empty')
  if (!APP_ASSET_ROOT_ID_PATTERN.test(rootId)) {
    throw new Error(`Invalid app asset root id: ${rootId}`)
  }
}
