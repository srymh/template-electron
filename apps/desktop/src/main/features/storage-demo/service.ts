import type { ObjectStore, StoredObject } from '@repo/object-store'
import type { SQLiteTableEditor } from '@repo/sqlite-table-editor'
import type {
  StorageDemoObject,
  StorageDemoService,
  StorageDemoTableName,
} from '@your-app-name/api/storage-demo'

/**
 * 保存できるオブジェクトの上限。一覧は全件を一度に返すため、保存もこの件数までに抑え、
 * 画面から確認・削除できないオブジェクトを作らない。
 */
export const storageDemoObjectLimit = 500

/**
 * テーブルごとに保存できる行の上限。一覧は全件取得で上限を超えると失敗するため、
 * 追加もこの件数までに抑え、既存行を編集・削除できない状態を作らない。
 */
export const storageDemoRowLimit = 1000

/** service が使う、開いた後の資源と URL 発行能力。資源の所有と破棄は呼び出し側が持つ。 */
export type StorageDemoServiceDependencies = {
  objectStore: ObjectStore
  tableEditor: SQLiteTableEditor<StorageDemoTableName>
  /** 取得済みのキーと revision から、存在確認なしに配信 URL を組み立てる。 */
  createObjectUrl: (input: { key: string; revision: string }) => Promise<string>
  /** 件数の上限。省略時は `storageDemoObjectLimit`・`storageDemoRowLimit`。テストで小さくする。 */
  limits?: { objects?: number; rowsPerTable?: number }
}

/**
 * オブジェクトストアとテーブル編集を、renderer 向けの操作として組み合わせる。
 * @param dependencies - 開いた後の資源と URL 発行能力
 * @returns renderer へ公開する操作だけを持つ service
 */
export function createStorageDemoService({
  objectStore,
  tableEditor,
  createObjectUrl,
  limits = {},
}: StorageDemoServiceDependencies): StorageDemoService {
  const objectLimit = limits.objects ?? storageDemoObjectLimit
  const rowLimit = limits.rowsPerTable ?? storageDemoRowLimit

  /** 公開結果に revision 固定の URL を添える。digest などの内部情報は含めない。 */
  const toDemoObject = async (object: StoredObject): Promise<StorageDemoObject> => ({
    key: object.key,
    byteSize: object.byteSize,
    mediaType: object.metadata.mediaType,
    fileName: object.metadata.fileName,
    revision: object.revision,
    url: await createObjectUrl({ key: object.key, revision: object.revision }),
  })

  return {
    objects: {
      list: async () => {
        const objects = await objectStore.listRange({ offset: 0, limit: objectLimit })
        return Promise.all(objects.map(toDemoObject))
      },
      put: async ({ key, content, mediaType, fileName }) => {
        // 既存キーへの保存は件数を増やさないため、新しいキーのときだけ上限を確かめる。
        // 上限の位置にオブジェクトがあれば、すでに上限の件数に達している。
        const isNewKey = (await objectStore.find(key)) === null
        if (
          isNewKey &&
          (await objectStore.listRange({ offset: objectLimit - 1, limit: 1 })).length > 0
        ) {
          throw new Error(
            `保存できるオブジェクトは${objectLimit}件までです。不要なものを削除してください。`,
          )
        }

        const { object } = await objectStore.put({
          key,
          // IPC では Buffer などの派生型が届く場合があるため、Uint8Array に揃える。
          content: new Uint8Array(content),
          metadata: { mediaType, fileName },
        })
        return toDemoObject(object)
      },
      verify: async ({ key }) => (await objectStore.verify(key)).status,
      remove: async ({ key }) => objectStore.remove(key),
    },
    tables: {
      list: async () => tableEditor.listTables(),
      listRows: async ({ tableName }) =>
        tableEditor.listRows({
          tableName,
          range: { type: 'all', maxRows: rowLimit },
        }),
      createRow: async (input) => {
        // 一覧の全件取得が失敗しないよう、上限に達したテーブルには追加しない。
        const { total } = tableEditor.listRows({
          tableName: input.tableName,
          range: { type: 'page', limit: 1, offset: 0 },
        })
        if (total >= rowLimit) {
          throw new Error(
            `1つのテーブルに追加できる行は${rowLimit}行までです。不要な行を削除してください。`,
          )
        }
        return tableEditor.createRow(input)
      },
      updateRow: async (input) => tableEditor.updateRow(input),
      removeRow: async (input) => tableEditor.removeRow(input),
    },
  }
}
