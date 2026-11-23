import { z } from 'zod'

/** SQLite table editorで受け渡せるスカラー値。 */
export const SQLiteTableEditorValueSchema = z.union([z.string(), z.number(), z.null()])

/** SQLite table editorで受け渡せるスカラー値。 */
export type SQLiteTableEditorValue = z.infer<typeof SQLiteTableEditorValueSchema>

/** 公開スカラー値とSQLite driverが扱う保存値の変換境界。 */
export type SQLiteTableEditorColumnCodec = {
  parseExternal: (value: unknown) => SQLiteTableEditorValue
  toDatabase: (value: SQLiteTableEditorValue) => unknown
  fromDatabase: (value: unknown) => SQLiteTableEditorValue
}

/** SQLiteテーブルの一行を、カラム名と値の組として表した型。 */
export const SQLiteTableEditorRowSchema = z.record(z.string(), SQLiteTableEditorValueSchema)

/** SQLiteテーブルの一行を、カラム名と値の組として表した型。 */
export type SQLiteTableEditorRow = z.infer<typeof SQLiteTableEditorRowSchema>

/** SQLite table editorで選択肢として表示できる値とラベル。 */
export type SQLiteTableEditorAllowedValueOption = {
  value: SQLiteTableEditorValue
  label: string | null
}

/** SQLite table editorで扱うカラムの定義。 */
export type SQLiteTableEditorColumn = {
  name: string
  dataType: string
  notNull: boolean
  defaultValue: string | null
  primaryKeyOrder: number | null
  editable: boolean
  allowedValues: SQLiteTableEditorValue[] | null
  allowedValueOptions: SQLiteTableEditorAllowedValueOption[] | null
}

/** SQLiteテーブル行の値に対応する表示補助ラベル。 */
export type SQLiteTableEditorRowLabels = Record<string, string | null>

/** SQLite table editorで扱う外部キーのカラム対応。 */
export type SQLiteTableEditorForeignKey = {
  id: number
  sequence: number
  fromColumn: string
  referencedTable: string
  referencedColumn: string
  onUpdate: string
  onDelete: string
}

/** allowlist登録されたSQLiteテーブルの表示・編集定義。 */
export type SQLiteTableEditorTableDefinition<TTableName extends string = string> = {
  tableName: TTableName
  displayName: string
  columns: SQLiteTableEditorColumn[]
  primaryKey: string[]
  uniqueKeys: Array<{ columns: string[] }>
  foreignKeys: SQLiteTableEditorForeignKey[]
  schemaSql: string
}

/** SQLite table editorで取得する行範囲。 */
export const SQLiteTableEditorRowsRangeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('page'),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal('all'),
    maxRows: z.number().int().min(1),
  }),
])

/** SQLite table editorの行一覧取得入力。 */
export const SQLiteTableEditorListRowsInputSchema = z.object({
  tableName: z.string().min(1),
  range: SQLiteTableEditorRowsRangeSchema,
})

/** SQLite table editorの行一覧取得入力。 */
export type SQLiteTableEditorListRowsInput<TTableName extends string = string> = Omit<
  z.input<typeof SQLiteTableEditorListRowsInputSchema>,
  'tableName'
> & {
  tableName: TTableName
}

/** SQLite table editorが返す行一覧。 */
export type SQLiteTableEditorRowsResult<TTableName extends string = string> = {
  tableName: TTableName
  rows: SQLiteTableEditorRow[]
  rowLabels: SQLiteTableEditorRowLabels[]
  total: number
  range: { type: 'page'; limit: number; offset: number } | { type: 'all' }
}

/** SQLite table editorの行追加入力。 */
export const SQLiteTableEditorCreateRowInputSchema = z.object({
  tableName: z.string().min(1),
  row: SQLiteTableEditorRowSchema,
})

/** SQLite table editorの行追加入力。 */
export type SQLiteTableEditorCreateRowInput<TTableName extends string = string> = Omit<
  z.infer<typeof SQLiteTableEditorCreateRowInputSchema>,
  'tableName'
> & {
  tableName: TTableName
}

/** SQLite table editorによる行追加結果。 */
export type SQLiteTableEditorCreateResult<TTableName extends string = string> = {
  tableName: TTableName
  row: SQLiteTableEditorRow
}

/** SQLite table editorの既存行更新入力。 */
export const SQLiteTableEditorUpdateRowInputSchema = z.object({
  tableName: z.string().min(1),
  key: SQLiteTableEditorRowSchema,
  changes: SQLiteTableEditorRowSchema,
})

/** SQLite table editorの既存行更新入力。 */
export type SQLiteTableEditorUpdateRowInput<TTableName extends string = string> = Omit<
  z.infer<typeof SQLiteTableEditorUpdateRowInputSchema>,
  'tableName'
> & {
  tableName: TTableName
}

/** SQLite table editorによる更新前後の行と変更有無。 */
export type SQLiteTableEditorUpdateResult<TTableName extends string = string> = {
  tableName: TTableName
  key: SQLiteTableEditorRow
  before: SQLiteTableEditorRow
  after: SQLiteTableEditorRow
  changed: boolean
}

/** SQLite table editorの行削除入力。 */
export const SQLiteTableEditorRemoveRowInputSchema = z.object({
  tableName: z.string().min(1),
  key: SQLiteTableEditorRowSchema,
})

/** SQLite table editorの行削除入力。 */
export type SQLiteTableEditorRemoveRowInput<TTableName extends string = string> = Omit<
  z.infer<typeof SQLiteTableEditorRemoveRowInputSchema>,
  'tableName'
> & {
  tableName: TTableName
}

/** SQLite table editorによる行削除結果。 */
export type SQLiteTableEditorRemoveResult<TTableName extends string = string> = {
  tableName: TTableName
  key: SQLiteTableEditorRow
  before: SQLiteTableEditorRow
  removed: boolean
}

/** 複数の主キーに一致する行を一括取得する入力。 */
export type SQLiteTableEditorFindRowsByKeysInput<TTableName extends string = string> = {
  tableName: TTableName
  keys: SQLiteTableEditorRow[]
}

/** 解決済みテーブルを同じtransaction内で操作する低水準能力。 */
export type SQLiteTableEditorPreparedTable<TTableName extends string> = {
  definition: SQLiteTableEditorTableDefinition<TTableName>
  columnCodecs: Readonly<Record<string, SQLiteTableEditorColumnCodec>>
  findRowsByKeys: (keys: SQLiteTableEditorRow[]) => SQLiteTableEditorRow[]
  listRowLabels: (rows: SQLiteTableEditorRow[]) => SQLiteTableEditorRowLabels[]
  createRowInTransaction: (row: SQLiteTableEditorRow) => SQLiteTableEditorCreateResult<TTableName>
  updateRowInTransaction: (
    key: SQLiteTableEditorRow,
    changes: SQLiteTableEditorRow,
  ) => SQLiteTableEditorUpdateResult<TTableName>
  removeRowInTransaction: (key: SQLiteTableEditorRow) => SQLiteTableEditorRemoveResult<TTableName>
}
