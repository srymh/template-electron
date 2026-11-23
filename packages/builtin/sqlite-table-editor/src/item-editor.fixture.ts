import type { Database } from '@repo/sqlite'

import { createSQLiteTableEditor } from './index'

/** 参照・既定値・複合一意制約を持つ編集対象を準備する。接続の生成と破棄は呼び出し側が行う。 */
export function createItemEditor(database: Database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE label (
      label_id INTEGER NOT NULL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    ) STRICT, WITHOUT ROWID;
    CREATE TABLE item (
      item_id INTEGER NOT NULL PRIMARY KEY,
      label_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      UNIQUE (label_id, name),
      FOREIGN KEY (label_id) REFERENCES label(label_id)
    ) STRICT, WITHOUT ROWID;
  `)
  const editor = createSQLiteTableEditor(database, {
    tableNames: ['item'] as const,
    getConfig: () => ({
      displayName: '項目',
      editableColumns: { label_id: null, name: null, note: null },
      referenceLabels: {
        label_id: {
          tableName: 'label',
          valueColumn: 'label_id',
          labelColumn: 'name',
        },
      },
      allowBatchUpsert: true,
      allowBatchDelete: true,
    }),
  })
  return editor
}
