import type { StorageDemoTablesService } from '@your-app-name/api/storage-demo'

/** デモ用テーブルの定義。 */
export type TableDefinition = Awaited<ReturnType<StorageDemoTablesService['list']>>[number]

/** テーブル定義の一列。 */
export type TableColumn = TableDefinition['columns'][number]

/** テーブルの一行。列名と値の組。 */
export type TableRow = Awaited<ReturnType<StorageDemoTablesService['listRows']>>['rows'][number]

/** 一つのセルの値。 */
export type CellValue = TableRow[string]

/**
 * SQLite の型名から数値列かを判定する（型アフィニティの規則に合わせる）。
 * @param dataType - SQLite の列型
 * @returns 数値として入力・比較する列なら `true`
 */
export function isNumeric(dataType: string): boolean {
  return /INT|REAL|FLOA|DOUB|NUM/i.test(dataType)
}

/**
 * 入力欄の文字列を列の型に合わせる。NOT NULL でない列の空欄は NULL にする。
 * @param column - 入力対象の列
 * @param value - 入力欄の文字列
 * @returns 数値列は数値（空欄は NULL）、それ以外は文字列か NULL
 */
export function parseInput(column: TableColumn, value: string): CellValue {
  if (isNumeric(column.dataType)) {
    return value.trim() === '' ? null : Number(value)
  }
  return value === '' && !column.notNull ? null : value
}

/**
 * 値を入力欄に表示する文字列にする。NULL は空欄にする。
 * @param value - セルの値
 * @returns 入力欄の値
 */
export function toInputValue(value: CellValue | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * 行を識別する文字列。主キー列の値を JSON にして、区切り文字との衝突を避ける。
 * @param definition - 行が属するテーブルの定義
 * @param row - 対象の行
 * @returns 同じテーブル内で一意な文字列
 */
export function primaryKeyId(definition: TableDefinition, row: TableRow): string {
  return JSON.stringify(definition.primaryKey.map((name) => row[name] ?? null))
}

/**
 * 行から主キー列だけを取り出す。
 * @param definition - 行が属するテーブルの定義
 * @param row - 対象の行
 * @returns 更新・削除の対象を指定する主キー
 */
export function primaryKeyOf(definition: TableDefinition, row: TableRow): TableRow {
  return Object.fromEntries(definition.primaryKey.map((name) => [name, row[name] ?? null]))
}

/**
 * 新規行の入力欄の初期値。選択肢のある列は先頭の候補、それ以外は空欄にする。
 * @param definition - 入力対象のテーブルの定義
 * @returns 主キーと編集可能な列の入力欄の文字列
 */
export function initialInputs(definition: TableDefinition): Record<string, string> {
  return Object.fromEntries(
    formColumns(definition).map((column) => [
      column.name,
      toInputValue(column.allowedValueOptions?.[0]?.value),
    ]),
  )
}

/**
 * 入力フォームに並べる列。主キーと編集可能な列だけを定義の順に返す。
 * @param definition - 入力対象のテーブルの定義
 * @returns 入力欄を表示する列
 */
export function formColumns(definition: TableDefinition): TableColumn[] {
  return definition.columns.filter((column) => column.editable || column.primaryKeyOrder !== null)
}

/**
 * バイト数を読みやすい単位の文字列にする。
 * @param byteSize - バイト数
 * @returns `B`・`KB`・`MB` のいずれかの単位を付けた文字列
 */
export function formatByteSize(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} B`
  if (byteSize < 1024 * 1024) return `${(byteSize / 1024).toFixed(1)} KB`
  return `${(byteSize / 1024 / 1024).toFixed(1)} MB`
}
