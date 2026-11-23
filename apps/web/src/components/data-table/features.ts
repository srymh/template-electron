import {
  cellSelectionFeature,
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_equals,
  filterFn_equalsString,
  filterFn_inDateRange,
  filterFn_inNumberRange,
  filterFn_includesString,
  filterFn_weakEquals,
  globalFilteringFeature,
  metaHelper,
  rowExpandingFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table'
import type { GroupingColumnMode, RowData, Table, TableState } from '@tanstack/react-table'

import type { TableCapabilities } from './capabilities'
import { filterDraftFeature } from './filter/filter-draft-feature'
import { dateRangeFilter, fuzzyFilter } from './filter/filter-fns'
import type { FuzzyFilterMeta } from './filter/filter-fns'

/**
 * 列定義の `meta`。
 *
 * @remarks
 * `filterVariant` で見出しに表示する列フィルターを選ぶ。
 * - `number-range`: 最小値・最大値の入力。候補の最小値・最大値を入力欄の案内に示し、確定時に補正する。
 *   `filterFn: 'inNumberRange'` と組み合わせる
 * - `number-equals`: 候補の数値と件数から選ぶ選択欄。`filterFn: 'equals'` と組み合わせる
 * - `text`: 候補を入力補完に出す文字列の入力欄。`filterFn: 'includesString'` と組み合わせる
 * - `select`: 候補の値（文字列・数値・真偽値）と件数から選ぶ選択欄。
 *   `filterFn: 'equals'`・`'equalsString'` などと組み合わせる
 * - `boolean`: `true`・`false` と件数から選ぶ選択欄。`filterFn: 'equals'` と組み合わせる
 * - `date-range`: `YYYY-MM-DD` 形式の日付の範囲の入力。`filterFn: 'dateRange'` と組み合わせる
 * - 未指定: 列フィルターを表示しない
 *
 * `label` は列メニュー・操作の名前に使う表示名。`header` が文字列でない列（チェックボックスの見出しなど）に指定する。
 */
export type DataTableColumnMeta = {
  filterVariant?: 'number-range' | 'number-equals' | 'text' | 'select' | 'boolean' | 'date-range'
  label?: string
}

/**
 * スクロール領域の高さの決め方。
 *
 * @remarks
 * - `content`: 内容の高さにする。枠の中では縦にスクロールしない
 * - `fill`: 親（flex 列）の残りの高さを埋め、溢れた行を枠の中でスクロールする（既定）
 * - `fixed`: スクロール領域を {@link TableLayout.height} の高さにする
 * - `max`: 内容の高さにし、{@link TableLayout.height} を上限として溢れた行を枠の中でスクロールする
 */
export type TableHeightStrategy = 'content' | 'fill' | 'fixed' | 'max'

/**
 * `fixed`・`max` の高さ。数値は CSS px、文字列は CSS の長さ（`'24rem'`・`'55vh'` など）。
 */
export type TableHeightLength = number | string

/** テーブルの機能ではなく、表示部品が持つ表示設定。 */
export type TableLayout = {
  /** グループ化した列の扱い。 */
  groupedColumnMode: GroupingColumnMode
  /** `table` を枠の幅いっぱいに広げるか。 */
  fullWidth: boolean
  /**
   * 列幅を状態の幅に固定するか（`table-layout: fixed`）。
   * `false` なら内容に合わせ、列の `size` は最小幅として扱う。
   */
  tableFixed: boolean
  /** 見出しに列フィルターを表示するか。 */
  showColumnFilters: boolean
  /**
   * 列の固定・解除のボタンを見出しに表示するか（既定 false）。隠しても能力と状態は変えず、
   * 固定した列はそのまま固定表示する。
   */
  showColumnPinningButtons: boolean
  /** グループ化・解除ボタンを見出しに表示するか（既定 false）。隠しても状態は変えない。 */
  showColumnGroupingButtons: boolean
  /** 行選択列を表示するか（既定 true）。選択の能力と状態は変えない。 */
  showRowSelectionColumn: boolean
  /** 上下への行固定操作列を表示するか（既定 false）。固定の能力と状態は変えない。 */
  showRowPinningColumn: boolean
  /** スクロール領域の高さの決め方。 */
  heightStrategy: TableHeightStrategy
  /** `heightStrategy` が `fixed` のときのスクロール領域の高さ、`max` のときの高さの上限。 */
  height: TableHeightLength
}

/**
 * テーブルの `meta`。登録した部品が、テーブルごとの設定を読むために使う。
 *
 * @remarks
 * `idPrefix` は、同じ文書に複数のテーブルを置いても DOM の id や
 * ラジオボタンの name が重ならないよう、テーブルごとに一意にする。
 *
 * 一覧検索・列フィルターの解除は、`filterResetFeature` の操作（`table.clearFilters()`・
 * `column.clearFilter()` など）で行う。
 */
export type DataTableMeta = {
  capabilities: TableCapabilities
  layout: TableLayout
  onChangeLayout: (layout: Partial<TableLayout>) => void
  onResetLayout: () => void
  pageSizeOptions: number[]
  idPrefix: string
}

/**
 * 共通テーブルに登録する、すべての機能・行モデル・関数。
 *
 * @remarks
 * 機能・行モデル・関数は共通に保ち、tableMetaだけをfactoryごとの型にする。各テーブルで
 * 使う能力は {@link TableCapabilities} で選び、`enable*` オプションと
 * 部品の表示で切り替える。前提となる機能は、それに依存する行モデルや
 * 関数の登録より前に置く。
 *
 * 列フィルター・並び替えの関数は、使うものだけを名前で登録する。組み込みの関数は、
 * 列定義で名前を指定するものと、未指定の列の自動判定（`'auto'`）が値の型から選ぶものを登録し、
 * 列フィルターにはあいまい検索の `fuzzy` と日付範囲の `dateRange` を加える。
 * 登録していない名前は、列定義で指定できない。
 * @returns 共通の登録と利用側metaの型を持つ、参照を保って使う機能登録
 */
export function createDataTableFeatures<TMeta extends object>() {
  return tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    // 下書きと解除の操作は列フィルター・一覧検索の操作を使うため、それらの後に置く
    filterDraftFeature,
    columnFacetingFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    rowSortingFeature,
    rowPaginationFeature,
    columnOrderingFeature,
    columnVisibilityFeature,
    columnPinningFeature,
    columnSizingFeature,
    columnResizingFeature,
    rowPinningFeature,
    rowSelectionFeature,
    cellSelectionFeature,
    filteredRowModel: createFilteredRowModel(),
    facetedRowModel: createFacetedRowModel(),
    facetedUniqueValues: createFacetedUniqueValues(),
    facetedMinMaxValues: createFacetedMinMaxValues(),
    groupedRowModel: createGroupedRowModel(),
    sortedRowModel: createSortedRowModel(),
    expandedRowModel: createExpandedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    filterFns: {
      includesString: filterFn_includesString,
      equalsString: filterFn_equalsString,
      equals: filterFn_equals,
      weakEquals: filterFn_weakEquals,
      inNumberRange: filterFn_inNumberRange,
      inDateRange: filterFn_inDateRange,
      arrIncludes: filterFn_arrIncludes,
      fuzzy: fuzzyFilter,
      dateRange: dateRangeFilter,
    },
    sortFns: {
      alphanumeric: sortFn_alphanumeric,
      text: sortFn_text,
      datetime: sortFn_datetime,
      basic: sortFn_basic,
    },
    tableMeta: metaHelper<TMeta & { dataTable: DataTableMeta }>(),
    columnMeta: metaHelper<DataTableColumnMeta>(),
    filterMeta: metaHelper<FuzzyFilterMeta>(),
  })
}

/** 利用側のmetaを持たない既定の機能登録。 */
export const dataTableFeatures = createDataTableFeatures<Record<never, never>>()

/** {@link dataTableFeatures} の型。 */
export type DataTableFeatures<TMeta extends object = Record<never, never>> = ReturnType<
  typeof createDataTableFeatures<TMeta>
>

// 登録した部品は行データの型を知らず、TanStack Table の型は行データについて不変のため、
// 部品の中では行データを any として扱う。行データの型は useDataTable・DataTableView の境界で保つ。
/** 登録した部品が扱う行データ。 */
export type ComponentRowData = any

/** 登録した部品が扱うテーブル。行データの型は部品からは決まらない。 */
export type DataTableCoreTable<
  TData extends RowData = ComponentRowData,
  TMeta extends object = Record<never, never>,
> = Table<DataTableFeatures<TMeta>, TData>

/**
 * テーブル本体の描画で購読する状態を選ぶ。
 *
 * @remarks
 * 行の並び・ヘッダーの構成に関わる状態だけを選ぶ。行選択・セル選択・列幅は
 * 頻繁に変わるため含めず、各行・各ヘッダーの購読で反映する。反映を待っている入力（下書き）も含めず、
 * 入力欄を持つ部品の購読で反映する。
 *
 * @param state - テーブル全体の状態
 * @returns 選んだ状態の各スライスを同じ参照のまま持つオブジェクト
 */
export function selectBodyState<TMeta extends object>(state: TableState<DataTableFeatures<TMeta>>) {
  return {
    sorting: state.sorting,
    columnFilters: state.columnFilters,
    globalFilter: state.globalFilter,
    grouping: state.grouping,
    expanded: state.expanded,
    pagination: state.pagination,
    columnOrder: state.columnOrder,
    columnVisibility: state.columnVisibility,
    columnPinning: state.columnPinning,
    rowPinning: state.rowPinning,
  }
}

/**
 * 登録した部品が使う `meta` を返す。
 *
 * @param table - `useDataTable` で作ったテーブル
 * @returns テーブルの `meta`
 * @throws `meta` が渡されていない場合（部品を `useDataTable` 以外の
 *   テーブルで使った場合など）
 */
export function getTableMeta(table: { options: { meta?: { dataTable: DataTableMeta } } }) {
  const meta = table.options.meta?.dataTable
  if (!meta) {
    throw new Error('共通テーブル部品は useDataTable で作ったテーブルの中で使う')
  }
  return meta
}
