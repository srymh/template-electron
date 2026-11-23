/**
 * 列の表示名を返す。列メニューや入力欄の名前に使う。
 *
 * @param column - 名前を求める列
 * @returns 列定義の `meta.label`、なければ `header` が文字列ならその文字列、それ以外は列 ID
 */
export function getColumnLabel(column: {
  id: string
  columnDef: { header?: unknown; meta?: { label?: string } }
}) {
  if (column.columnDef.meta?.label) return column.columnDef.meta.label
  return typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id
}
