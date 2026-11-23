import type { TableState } from '@tanstack/react-table'
import { getDefaultColumnResizingState } from '@tanstack/react-table/static-functions'

import type { DataTableFeatures } from './features'

/**
 * テーブルごとに選べる能力。`true` の能力だけを操作・表示する。指定しない能力は無効になる。
 *
 * @remarks
 * - `sorting`: 見出しのソート切り替え
 * - `columnFiltering`: 列の `meta.filterVariant` に応じた見出しの列フィルターと、その表示切り替え・解除
 * - `globalFiltering`: 操作行の一覧検索（あいまい検索）
 * - `grouping`: 見出しのグループ化切り替えと、グループ行の展開
 * - `pagination`: ページ送り。`false` なら全行を1ページに表示する
 * - `columnOrdering`: 見出し上端のハンドルによる列のドラッグ並べ替え
 * - `columnVisibility`: 操作行の列メニューによる列の表示・非表示
 * - `columnPinning`: 見出しの列の固定・解除
 * - `columnResizing`: 見出し右端のハンドルによる列幅の変更
 * - `rowPinning`: 行を上端・下端へ固定する操作列（末尾に追加する）
 * - `rowSelection`: 行選択のチェックボックス列（先頭に追加する）
 * - `cellSelection`: セル選択・キーボード移動と、下部の選択セルの表示・コピー
 */
export type TableCapabilities = {
  sorting: boolean
  columnFiltering: boolean
  globalFiltering: boolean
  grouping: boolean
  pagination: boolean
  columnOrdering: boolean
  columnVisibility: boolean
  columnPinning: boolean
  columnResizing: boolean
  rowPinning: boolean
  rowSelection: boolean
  cellSelection: boolean
}

/** 能力の名前。 */
export type TableCapability = keyof TableCapabilities

/** すべての能力を有効にした値。全能力を使う表は、これを明示して渡す。 */
export const allCapabilities: TableCapabilities = {
  sorting: true,
  columnFiltering: true,
  globalFiltering: true,
  grouping: true,
  pagination: true,
  columnOrdering: true,
  columnVisibility: true,
  columnPinning: true,
  columnResizing: true,
  rowPinning: true,
  rowSelection: true,
  cellSelection: true,
}

/** すべての能力を無効にした値。能力を指定しない表の基準にする。 */
export const noCapabilities: TableCapabilities = {
  sorting: false,
  columnFiltering: false,
  globalFiltering: false,
  grouping: false,
  pagination: false,
  columnOrdering: false,
  columnVisibility: false,
  columnPinning: false,
  columnResizing: false,
  rowPinning: false,
  rowSelection: false,
  cellSelection: false,
}

// 無効な能力だけを既定値で制御する。有効な能力の状態はテーブルが所有する。
// undefined は initialState に戻るため、グローバルフィルターには空文字を使う。
const disabledStateByCapability: Record<TableCapability, Partial<TableState<DataTableFeatures>>> = {
  sorting: { sorting: [] },
  columnFiltering: { columnFilters: [] },
  globalFiltering: { globalFilter: '' },
  grouping: { grouping: [], expanded: {} },
  pagination: { pagination: { pageIndex: 0, pageSize: 10 } },
  columnOrdering: { columnOrder: [] },
  columnVisibility: { columnVisibility: {} },
  columnPinning: { columnPinning: { start: [], end: [] } },
  columnResizing: { columnSizing: {}, columnResizing: getDefaultColumnResizingState() },
  rowPinning: { rowPinning: { top: [], bottom: [] } },
  rowSelection: { rowSelection: {} },
  cellSelection: { cellSelection: [] },
}

/**
 * 指定した能力を基準の値に重ねる。
 *
 * @param capabilities - 有効・無効を指定する能力だけを持つオブジェクト。`undefined` の値は基準のままにする
 * @param base - 基準にする能力。省略時は {@link noCapabilities}（指定しない能力は無効）
 * @returns すべての能力を持つ新しいオブジェクト
 */
export function resolveCapabilities(
  capabilities?: Partial<TableCapabilities>,
  base: TableCapabilities = noCapabilities,
) {
  const resolved = { ...base }
  for (const key of Object.keys(base) as TableCapability[]) {
    const value = capabilities?.[key]
    if (value !== undefined) resolved[key] = value
  }
  return resolved
}

/**
 * 能力を、操作の有効・無効と状態の制御オプションに変換する。
 *
 * @remarks
 * 列の並べ替えには対応する `enable*` がないため、操作は部品の表示で切り替える。
 * ページ分割を無効にする場合は `manualPagination` にし、
 * ページ分割前の行をそのまま表示する。
 * 無効な能力の状態は既定値で制御し、操作 UI がない状態での適用を防ぐ。
 * React の commit 後には内部状態も既定値になるため、再有効化しても復元しない。
 *
 * @param capabilities - すべての能力を持つオブジェクト
 * @returns テーブルに渡すオプション
 */
export function getCapabilityTableOptions(capabilities: TableCapabilities) {
  const state: Partial<TableState<DataTableFeatures>> = {}
  for (const key of Object.keys(disabledStateByCapability) as TableCapability[]) {
    if (!capabilities[key]) Object.assign(state, disabledStateByCapability[key])
  }

  return {
    state,
    enableSorting: capabilities.sorting,
    enableColumnFilters: capabilities.columnFiltering,
    enableGlobalFilter: capabilities.globalFiltering,
    enableGrouping: capabilities.grouping,
    enableExpanding: capabilities.grouping,
    manualPagination: !capabilities.pagination,
    enableHiding: capabilities.columnVisibility,
    enableColumnPinning: capabilities.columnPinning,
    enableColumnResizing: capabilities.columnResizing,
    enableRowPinning: capabilities.rowPinning,
    enableRowSelection: capabilities.rowSelection,
    enableCellSelection: capabilities.cellSelection,
  }
}
