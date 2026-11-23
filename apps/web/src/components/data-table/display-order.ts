import type { Row, RowData } from '@tanstack/react-table'

import type { DataTableCoreTable, DataTableFeatures } from './features'

/**
 * 本文に描画する行を、実際の表示順に並べて返す。
 *
 * @param table - `useDataTable` で作ったテーブル
 * @returns 上端の固定行・中央の行・下端の固定行の順に並べた新しい配列
 */
export function getDisplayRows<TData extends RowData, TMeta extends object>(
  table: DataTableCoreTable<TData, TMeta>,
) {
  return [...table.getTopRows(), ...table.getCenterRows(), ...table.getBottomRows()]
}

/**
 * 表示中の列を、実際の表示順に並べて返す。
 *
 * @param table - `useDataTable` で作ったテーブル
 * @returns 先頭側の固定列・中央の列・末尾側の固定列の順に並べた新しい配列
 */
export function getDisplayColumns<TData extends RowData, TMeta extends object>(
  table: DataTableCoreTable<TData, TMeta>,
) {
  return [
    ...table.getStartVisibleLeafColumns(),
    ...table.getCenterVisibleLeafColumns(),
    ...table.getEndVisibleLeafColumns(),
  ]
}

/**
 * 行の表示中のセルを、実際の表示順に並べて返す。
 *
 * @param row - 対象の行
 * @returns 先頭側の固定列・中央の列・末尾側の固定列の順に並べた新しい配列
 */
export function getDisplayCells<TData extends RowData, TMeta extends object>(
  row: Row<DataTableFeatures<TMeta>, TData>,
) {
  return [
    ...row.getStartVisibleCells(),
    ...row.getCenterVisibleCells(),
    ...row.getEndVisibleCells(),
  ]
}
