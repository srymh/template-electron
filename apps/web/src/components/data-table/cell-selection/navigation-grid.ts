import type { RowData } from '@tanstack/react-table'

import { getDisplayCells, getDisplayRows } from '../display-order'
import type { DataTableCoreTable } from '../features'
import type { CellNavigationGrid } from './cell-navigation'

/**
 * 本文に描画する全セルを、固定行・固定列を含めた実際の表示順に並べたグリッドを返す。
 *
 * @remarks
 * キーボードでのセル移動と Tab の到達先に使う。各行・各セルへ props で渡さず、使う時点で
 * テーブルから読む。行・列は描画と同じく、上端の固定行・中央・下端の固定行、
 * 先頭側の固定列・中央・末尾側の固定列の順に並べる。
 * 呼ぶたびに作る。Tab の到達先は全行で共通の表示状態（`BodyRow`）の中で状態の変更ごとに1回、
 * キーボードでの移動はキーを押したときに1回だけ呼ぶ。どちらもセル選択を使う表でだけ呼ぶ。
 *
 * @param table - `useDataTable` で作ったテーブル
 * @returns 行ごとの表示中のセル。非表示の行・列は含めない
 */
export function getNavigationGrid<TData extends RowData, TMeta extends object>(
  table: DataTableCoreTable<TData, TMeta>,
): CellNavigationGrid {
  return getDisplayRows(table).map(getDisplayCells)
}
