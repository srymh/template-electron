import type { ApiInterface, WithCallerKeyApi } from '@repo/ipc'
import type { ObjectMetadata } from '@repo/object-store'
import type {
  SQLiteTableEditorCreateResult,
  SQLiteTableEditorCreateRowInput,
  SQLiteTableEditorRemoveResult,
  SQLiteTableEditorRemoveRowInput,
  SQLiteTableEditorRowsResult,
  SQLiteTableEditorTableDefinition,
  SQLiteTableEditorUpdateResult,
  SQLiteTableEditorUpdateRowInput,
} from '@repo/sqlite-table-editor'

// -----------------------------------------------------------------------------
// 型定義

export const STORAGE_DEMO_API_KEY = 'storageDemo' as const
export type StorageDemoApiKey = typeof STORAGE_DEMO_API_KEY

/** デモ用 DB で編集を許可するテーブル名。 */
export const storageDemoTableNames = ['demo_category', 'demo_item'] as const

/** デモ用 DB で編集を許可するテーブル名。 */
export type StorageDemoTableName = (typeof storageDemoTableNames)[number]

/** 一覧に表示するオブジェクトの情報と、本文を表示するための URL。 */
export type StorageDemoObject = {
  key: string
  byteSize: number
  mediaType: ObjectMetadata['mediaType']
  fileName: ObjectMetadata['fileName']
  revision: string
  /** 取得時の revision に固定した `app-asset://` の URL。更新・削除後は配信されない。 */
  url: string
}

/** オブジェクトの保存入力。キーは利用側が決め、内容はバイト列で渡す。 */
export type StorageDemoPutObjectInput = {
  key: string
  content: Uint8Array
  mediaType: string | null
  fileName: string | null
}

/** オブジェクトの本文と記録したサイズ・digest の検証結果。 */
export type StorageDemoObjectVerification =
  | 'missing-key'
  | 'valid'
  | 'missing-content'
  | 'corrupt-content'

/** オブジェクトストアの操作。 */
export type StorageDemoObjectsService = {
  /** キーの昇順で全件を返す。 */
  list: () => Promise<StorageDemoObject[]>
  /** 新しいキーで保存する。既存キーへの別内容の保存は拒否する。 */
  put: (input: StorageDemoPutObjectInput) => Promise<StorageDemoObject>
  /** 本文の digest を再計算して状態を返す。 */
  verify: (input: { key: string }) => Promise<StorageDemoObjectVerification>
  /** キーを削除する。存在しなければ `false`。 */
  remove: (input: { key: string }) => Promise<boolean>
}

/** デモ用 DB のテーブル参照・編集操作。 */
export type StorageDemoTablesService = {
  list: () => Promise<SQLiteTableEditorTableDefinition<StorageDemoTableName>[]>
  listRows: (input: {
    tableName: StorageDemoTableName
  }) => Promise<SQLiteTableEditorRowsResult<StorageDemoTableName>>
  createRow: (
    input: SQLiteTableEditorCreateRowInput<StorageDemoTableName>,
  ) => Promise<SQLiteTableEditorCreateResult<StorageDemoTableName>>
  updateRow: (
    input: SQLiteTableEditorUpdateRowInput<StorageDemoTableName>,
  ) => Promise<SQLiteTableEditorUpdateResult<StorageDemoTableName>>
  removeRow: (
    input: SQLiteTableEditorRemoveRowInput<StorageDemoTableName>,
  ) => Promise<SQLiteTableEditorRemoveResult<StorageDemoTableName>>
}

/** renderer へ公開する保存機能デモの操作。 */
export type StorageDemoService = {
  objects: StorageDemoObjectsService
  tables: StorageDemoTablesService
}

export type StorageDemoContext = {
  getService: () => Promise<StorageDemoService>
}

// -----------------------------------------------------------------------------
// インターフェイス定義

export type StorageDemoApi = ApiInterface<StorageDemoService>

// -----------------------------------------------------------------------------
// 実装

/**
 * 呼び出し元キーに対応する service へ各操作を委譲する保存機能デモの API を構成する。
 * @param getContext - 呼び出し元キーに対応する context を取得する関数
 * @returns 呼び出し元キー付きの操作群。service の取得・実行時の例外は reject で伝える
 */
export function getStorageDemoApi<TKey>(
  getContext: (key: TKey) => StorageDemoContext,
): WithCallerKeyApi<StorageDemoApi, TKey> {
  const getService = (key: TKey) => getContext(key).getService()

  return {
    objects: {
      list: (key) => async () => (await getService(key)).objects.list(),
      put: (key) => async (input) => (await getService(key)).objects.put(input),
      verify: (key) => async (input) => (await getService(key)).objects.verify(input),
      remove: (key) => async (input) => (await getService(key)).objects.remove(input),
    },
    tables: {
      list: (key) => async () => (await getService(key)).tables.list(),
      listRows: (key) => async (input) => (await getService(key)).tables.listRows(input),
      createRow: (key) => async (input) => (await getService(key)).tables.createRow(input),
      updateRow: (key) => async (input) => (await getService(key)).tables.updateRow(input),
      removeRow: (key) => async (input) => (await getService(key)).tables.removeRow(input),
    },
  }
}
