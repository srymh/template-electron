import fs from 'node:fs/promises'
import path from 'node:path'

import type { AppAssetRootRegistry } from '@repo/asset-protocol'
import { createFileSystemCas } from '@repo/cas/node'
import { createObjectStore } from '@repo/object-store'
import type { ObjectStore } from '@repo/object-store'
import { createSqliteObjectIndex } from '@repo/object-store/sqlite'
import type { ConnectionOptions, Database } from '@repo/sqlite'
import { createSQLiteTableEditor } from '@repo/sqlite-table-editor'
import type { StorageDemoService } from '@your-app-name/api/storage-demo'

import { createLazyResource } from './lazy-resource'
import type { OpenedResource } from './lazy-resource'
import { createObjectDelivery } from './object-delivery'
import {
  initializeStorageDemoSchema,
  storageDemoSchemaVersion,
  storageDemoTableRegistry,
} from './schema'
import { createStorageDemoService } from './service'

/** 破棄後の取得で通知するメッセージ。 */
export const storageDemoDisposedMessage = '保存機能デモの runtime は破棄済みです。'

/** デモ用 DB ファイルとオブジェクトストアの保存先。 */
export type StorageDemoStoragePaths = {
  /** sqlite-table-editor で編集するデモ用 DB ファイル。 */
  databasePath: string
  /** index DB と blobs を保持するオブジェクトストアのルート。 */
  objectStoreRoot: string
}

/**
 * デモ用 DB とオブジェクトストアの標準保存先を計算する。I/O は行わない。
 * @param appDataPath - host が決めた共有業務データの保存先
 * @returns runtime へ渡す保存先
 */
export function resolveStorageDemoStoragePaths(appDataPath: string): StorageDemoStoragePaths {
  const root = path.join(appDataPath, 'storage-demo')
  return {
    databasePath: path.join(root, `demo-schema-${storageDemoSchemaVersion}.db`),
    objectStoreRoot: path.join(root, 'object-store'),
  }
}

/** SQLite ファイルへ接続する host 能力。返した接続の所有権は runtime へ移る。 */
export type OpenDatabase = (filePath: string, connection?: ConnectionOptions) => Database

/** 保存先・接続・配信の host 能力。 */
export type CreateStorageDemoRuntimeOptions = {
  paths: StorageDemoStoragePaths
  /** 指定されたファイルに接続する。接続後の破棄は runtime が担当する。 */
  openDatabase: OpenDatabase
  /** 配信を登録・解除する host の registry。runtime 自身の登録だけを解除する。 */
  objectDeliveryRegistry: AppAssetRootRegistry
}

/** デモ用 DB とオブジェクトストアを遅延初期化し、service と終了処理を提供する。 */
export type StorageDemoRuntime = {
  /**
   * 両方の保存領域を開き、renderer 向けの service を取得する。
   * @returns 同時呼び出しでも共有する service
   * @throws 初期化失敗・破棄後の取得は reject する。初期化失敗後は再試行できる
   */
  getService: () => Promise<StorageDemoService>
  /**
   * 配信登録を解除し、初期化中のものも含めて両 DB の接続を解放する。
   * @returns 解放の完了で解決する。2 回目以降は何もしない
   */
  dispose: () => Promise<void>
}

/**
 * デモ用 DB とオブジェクトストアを所有する runtime を作成する。
 * 作成時は配信 root の登録だけを行い、DB は最初の操作で開く。
 * @param options - 保存先・SQLite 接続・配信登録などの host 能力
 * @returns service の取得と破棄の窓口
 */
export function createStorageDemoRuntime(
  options: CreateStorageDemoRuntimeOptions,
): StorageDemoRuntime {
  const { paths, openDatabase, objectDeliveryRegistry } = options
  let disposed = false

  // 配信はデモ用 DB を開かずに、オブジェクトストアだけを使う。
  const objectStore = createLazyResource(
    () => openObjectStore(paths.objectStoreRoot, openDatabase),
    storageDemoDisposedMessage,
  )
  const delivery = createObjectDelivery(objectDeliveryRegistry, objectStore.get)
  const tableDatabase = createLazyResource(
    () => openTableDatabase(paths.databasePath, openDatabase),
    storageDemoDisposedMessage,
  )
  const service = createLazyResource<StorageDemoService>(
    async () => ({
      value: createStorageDemoService({
        objectStore: await objectStore.get(),
        tableEditor: createSQLiteTableEditor(await tableDatabase.get(), storageDemoTableRegistry),
        createObjectUrl: delivery.createUrl,
      }),
      // 資源は各 lazy resource が所有するため、service 自体は解放するものを持たない。
      close: () => {},
    }),
    storageDemoDisposedMessage,
  )

  return {
    getService: service.get,
    dispose: async () => {
      if (disposed) {
        return
      }

      disposed = true
      // 新しい配信を止めてから、互いに独立した両 DB の初期化待ちと解放を並行する。
      delivery.dispose()
      await service.dispose()
      await Promise.all([objectStore.dispose(), tableDatabase.dispose()])
    },
  }
}

/**
 * 保存先ディレクトリとデモ用 DB を用意し、schema を初期化した接続を開く。
 * @param databasePath - デモ用 DB ファイル。親ディレクトリがなければ作成する
 * @param openDatabase - DB へ接続する host 能力
 * @returns 接続と解放処理
 * @throws 作成・接続・schema 初期化に失敗すると reject する。接続後の失敗では接続を閉じる
 */
async function openTableDatabase(
  databasePath: string,
  openDatabase: OpenDatabase,
): Promise<OpenedResource<Database>> {
  await fs.mkdir(path.dirname(databasePath), { recursive: true })
  // 参照先の選択肢と削除時の制約を確かめられるよう、外部キー制約を有効にする。
  const connection = openDatabase(databasePath, {
    foreignKeys: true,
    journalMode: 'wal',
    synchronous: 'normal',
  })
  try {
    initializeStorageDemoSchema(connection)
    return { value: connection, close: () => connection.close() }
  } catch (error) {
    connection.close()
    throw error
  }
}

/**
 * 保存先ディレクトリと index DB を用意し、ファイルシステム CAS と組み合わせた store を開く。
 * @param root - index DB と blobs を置くディレクトリ。存在しなければ作成する
 * @param openDatabase - index DB へ接続する host 能力
 * @returns store と index DB の解放処理
 * @throws 作成・接続・store 構築に失敗すると reject する。接続後の失敗では接続を閉じる
 */
async function openObjectStore(
  root: string,
  openDatabase: OpenDatabase,
): Promise<OpenedResource<ObjectStore>> {
  await fs.mkdir(root, { recursive: true })
  const connection = openDatabase(path.join(root, 'index.db'), {
    journalMode: 'wal',
    synchronous: 'full',
  })
  try {
    const store = createObjectStore({
      cas: createFileSystemCas(path.join(root, 'blobs')),
      index: createSqliteObjectIndex(connection),
    })
    return { value: store, close: () => connection.close() }
  } catch (error) {
    connection.close()
    throw error
  }
}
