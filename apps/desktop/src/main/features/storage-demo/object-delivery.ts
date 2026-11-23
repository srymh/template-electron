import { createAppAssetUrl } from '@repo/asset-protocol'
import type { AppAssetRootRegistry } from '@repo/asset-protocol'
import type { ObjectStore } from '@repo/object-store'

/** 保存機能デモのオブジェクトをapp-assetで配信するroot ID。 */
export const objectDeliveryRootId = 'storage-demo-objects'

const objectPathPrefix = 'objects/'

/** URLを発行する対象のキーと、任意のrevision一致条件。 */
export type ObjectUrlInput = { key: string; revision?: string }

type AppAssetStreamResolver = Exclude<
  Parameters<AppAssetRootRegistry['register']>[0]['resolveStream'],
  undefined
>

/** オブジェクトのURL発行と配信登録の解除。 */
export type ObjectDelivery = {
  /**
   * 現在のオブジェクト、または指定revisionと一致するオブジェクトのURLを発行する。
   * @param input - 対象キーと任意のrevision一致条件
   * @returns revision省略時は条件なしのURL。対象なし・revision不正・不一致はnull
   * @throws storeの取得・検索に失敗するとrejectする
   */
  getUrl: (input: ObjectUrlInput) => Promise<string | null>
  /**
   * 取得済みのキーとrevisionから、storeを開かず存在確認もせずにURLを組み立てる。
   * 対象の欠落・revision不一致は配信時に検査し、Not Foundとして扱う。
   * @param input - 取得済みのオブジェクトのキーとrevision
   * @returns revision条件付きのURL。getUrlでrevisionを指定した場合と同じ形式
   * @throws revisionが不正な場合はTypeErrorでrejectする
   */
  createUrl: (input: { key: string; revision: string }) => Promise<string>
  /**
   * 自身が登録した配信rootだけを解除する。共有registryは破棄しない。
   * @returns 値は返さない。複数回呼び出せる
   */
  dispose: () => void
}

/**
 * storeのオブジェクトをapp-assetで配信し、作成時に配信rootを登録する。
 * @param registry - 配信rootを登録・解除するhostのregistry
 * @param getObjectStore - URL発行・配信時にstoreを取得する。作成時には呼ばない
 * @returns URL発行と配信登録解除の窓口
 */
export function createObjectDelivery(
  registry: AppAssetRootRegistry,
  getObjectStore: () => Promise<ObjectStore>,
): ObjectDelivery {
  registry.register({
    id: objectDeliveryRootId,
    resolution: 'stream',
    cacheControl: 'no-store',
    resolveStream: createResolveStream(getObjectStore),
  })

  return {
    getUrl: async ({ key, revision }) => {
      // 不正なrevisionではstoreを開かずに対象なしとして扱う。
      if (revision !== undefined && !isValidRevision(revision)) {
        return null
      }

      const object = await (await getObjectStore()).find(key)
      if (!object || (revision !== undefined && object.revision !== revision)) {
        return null
      }

      return createObjectUrl(object.key, revision)
    },
    createUrl: async ({ key, revision }) => {
      if (!isValidRevision(revision)) {
        throw new TypeError('revisionには取得済みのオブジェクトのrevisionを指定してください。')
      }

      return createObjectUrl(key, revision)
    },
    dispose: () => {
      registry.unregister(objectDeliveryRootId)
    },
  }
}

/**
 * キーと任意のrevision条件から配信URLを作る。存在確認はしない。
 * @param key - 配信パスに含めるキー
 * @param revision - 指定時はURLのrevision条件にする
 * @returns app-assetのURL
 */
function createObjectUrl(key: string, revision: string | undefined): string {
  return createAppAssetUrl({
    rootId: objectDeliveryRootId,
    relativePath: objectPathPrefix + key,
    searchParams: revision === undefined ? undefined : { revision },
  })
}

/**
 * 配信パスとrevision queryを解釈し、解決時点の世代の本文だけを返すresolverを作る。
 * @param getObjectStore - 配信時に本文を保持するstoreを取得する
 * @returns 対象なし・条件不正・不一致ではnullを返すresolver
 */
function createResolveStream(getObjectStore: () => Promise<ObjectStore>): AppAssetStreamResolver {
  return async (relativePath, searchParams) => {
    // URLのパスは復元済みのキー、クエリは取得時のrevision条件として解釈する。
    if (!relativePath.startsWith(objectPathPrefix)) {
      return null
    }

    const key = relativePath.slice(objectPathPrefix.length)
    const revisions = searchParams.getAll('revision')
    // 条件の重複は意図を決められないため、どちらか一方を採用しない。
    if (!key || revisions.length > 1) {
      return null
    }

    const [revision] = revisions
    if (revision !== undefined && !isValidRevision(revision)) {
      return null
    }

    const store = await getObjectStore()
    const object = await store.find(key)
    if (!object || (revision !== undefined && object.revision !== revision)) {
      return null
    }

    return {
      byteSize: object.byteSize,
      mediaType: object.metadata.mediaType ?? 'application/octet-stream',
      read: async (range) => {
        const result = await store.readStream(key, range)
        // 条件省略時も、ヘッダーを作った時点のmetadata・サイズと本文を一致させる。
        if (result.object.revision !== object.revision) {
          throw new Error('オブジェクトが変更されました。再取得してください。')
        }

        return result.content
      },
    }
  }
}

// IPCから未検証の値も届くため型を確かめ、空文字・256文字超過・NUL文字を拒否する。
function isValidRevision(revision: unknown): boolean {
  return (
    typeof revision === 'string' &&
    revision.length > 0 &&
    revision.length <= 256 &&
    !revision.includes('\0')
  )
}
