import { runInTransaction } from '@repo/sqlite'
import type { Database } from '@repo/sqlite'
import type { SQLiteTableEditorConfig, SQLiteTableEditorRegistry } from '@repo/sqlite-table-editor'
import { storageDemoTableNames } from '@your-app-name/api/storage-demo'
import type { StorageDemoTableName } from '@your-app-name/api/storage-demo'

/** デモ用テーブルの schema version。変更時は既存 DB の扱いを決めてから上げる。 */
export const storageDemoSchemaVersion = 1

/** 項目の状態として許可する値。 */
export const storageDemoItemStatuses = ['draft', 'published', 'archived'] as const

const statusCheck = storageDemoItemStatuses.map((status) => `'${status}'`).join(', ')

/**
 * デモ用テーブルを用意し、空の DB には見本の行を入れる。
 * 既知の version なら何もせず、未知の version は拒否する。
 * @param database - 外部キー制約を有効にした接続。所有権は呼び出し側に残る
 * @throws 未知の schema version、または DDL の失敗で例外を投げる
 */
export function initializeStorageDemoSchema(database: Database): void {
  const version = database.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0
  if (version === storageDemoSchemaVersion) {
    return
  }
  if (version !== 0) {
    throw new Error(`未対応のデモ用 DB の schema version です: ${version}`)
  }

  // 作成と見本の投入を一つの transaction にまとめ、途中失敗で半端な schema を残さない。
  runInTransaction(database, () => {
    database.exec(`
      CREATE TABLE demo_category (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      ) STRICT;

      CREATE TABLE demo_item (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (${statusCheck})),
        category_id INTEGER REFERENCES demo_category (id),
        note TEXT
      ) STRICT;

      INSERT INTO demo_category (id, name) VALUES (1, '資料'), (2, '画像');
      INSERT INTO demo_item (id, title, status, category_id, note) VALUES
        (1, '最初の項目', 'published', 1, 'sqlite-table-editor で編集できます'),
        (2, '下書きの項目', 'draft', 2, NULL);

      PRAGMA user_version = ${storageDemoSchemaVersion};
    `)
  })
}

/** sqlite-table-editor へ渡す、デモ用テーブルの表示名と編集可能な列。 */
export const storageDemoTableRegistry: SQLiteTableEditorRegistry<StorageDemoTableName> = {
  tableNames: storageDemoTableNames,
  getConfig: (tableName): SQLiteTableEditorConfig => {
    switch (tableName) {
      case 'demo_category':
        return {
          displayName: '分類',
          editableColumns: { name: null },
        }
      case 'demo_item':
        return {
          displayName: '項目',
          editableColumns: {
            title: null,
            status: storageDemoItemStatuses,
            category_id: {
              referenceOptions: {
                tableName: 'demo_category',
                valueColumn: 'id',
                labelColumn: 'name',
                nullable: true,
                nullLabel: '未分類',
              },
            },
            note: null,
          },
          referenceLabels: {
            category_id: { tableName: 'demo_category', valueColumn: 'id', labelColumn: 'name' },
          },
        }
    }
  },
}
