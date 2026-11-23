import type { SQLiteTableEditorColumnCodec, SQLiteTableEditorValue } from './models'

export type SQLiteTableEditorReferenceLabelConfig = {
  tableName: string
  labelColumn: string
  fallbackLabel?: string
  keyColumns?: readonly {
    sourceColumn: string
    referenceColumn: string
  }[]
  valueColumn?: string
}

export type SQLiteTableEditorReferenceOptionsConfig = {
  tableName: string
  valueColumn: string
  labelColumn: string
  nullable?: boolean
  nullLabel?: string
}

export type SQLiteTableEditorEditableColumnConfig =
  | readonly SQLiteTableEditorValue[]
  | null
  | {
      referenceOptions: SQLiteTableEditorReferenceOptionsConfig
    }

export type SQLiteTableEditorConfig = {
  displayName: string
  editableColumns: Readonly<Record<string, SQLiteTableEditorEditableColumnConfig>>
  columnCodecs?: Readonly<Record<string, SQLiteTableEditorColumnCodec>>
  referenceLabels?: Readonly<Record<string, SQLiteTableEditorReferenceLabelConfig>>
  /** metadataに従う追加・更新の一括計画を許可する。 */
  allowBatchUpsert?: boolean
  /** metadataに従う削除の一括計画を許可する。 */
  allowBatchDelete?: boolean
}

export type SQLiteTableEditorRegistry<TTableName extends string> = {
  tableNames: readonly TTableName[]
  getConfig: (tableName: TTableName) => SQLiteTableEditorConfig
}
