import {
  assignPrototypeAPIs,
  assignTableAPIs,
  functionalUpdate,
  makeStateUpdater,
} from '@tanstack/react-table'
import type {
  OnChangeFn,
  RowData,
  TableFeature,
  TableFeatures,
  Updater,
} from '@tanstack/react-table'

/**
 * 反映を待っている入力（下書き）。
 *
 * @remarks
 * `base` は書き始めた時点の確定値。確定値が外から変わり `base` と異なると、下書きは無効になり、
 * 入力欄は確定値を表示し、確定しても適用しない。
 */
export type FilterDraft = {
  readonly value: unknown
  readonly base: unknown
}

/** 一覧検索と列フィルターの下書き。下書きのない入力はキーを持たない。 */
export type FilterDrafts = {
  readonly globalFilter?: FilterDraft
  readonly columns: Readonly<Record<string, FilterDraft>>
}

type TableState_FilterDraft = {
  filterDrafts: FilterDrafts
}

type TableOptions_FilterDraft = {
  onFilterDraftsChange?: OnChangeFn<FilterDrafts>
}

/** 一覧検索の下書きと、下書きごと絞り込みを解除するテーブルの操作。 */
type Table_FilterDraft = {
  /** 一覧検索とすべての列フィルターを解除する。反映を待っている入力もすべて捨てる。 */
  clearFilters: () => void
  /**
   * すべての列フィルターを解除する。反映を待っている列フィルターと一覧検索の入力を捨てる。
   * 一覧検索の値は変えない。
   */
  clearColumnFilters: () => void
  /**
   * 一覧検索を解除する。反映を待っている一覧検索と列フィルターの入力を捨てる。
   * 列フィルターの値は変えない。
   */
  clearGlobalFilter: () => void
  /** 一覧検索の入力欄に表示する値。有効な下書きがあればその値、なければ確定値。 */
  getGlobalFilterInputValue: () => unknown
  /** 一覧検索の下書きを書く。確定はしない。 */
  setGlobalFilterDraft: (updater: Updater<unknown>) => void
  /**
   * 有効な一覧検索の下書きを確定値にし、下書きを消す。下書きが無効なら消すだけにする。
   * @param toFilterValue - 下書きから確定値を作る。省略時は下書きの値をそのまま使う
   */
  commitGlobalFilterDraft: (toFilterValue?: (draft: unknown) => unknown) => void
  /** 一覧検索の下書きを、確定せずに捨てる。 */
  discardGlobalFilterDraft: () => void
}

/** 列フィルターの下書きと、下書きごと解除する列の操作。 */
type Column_FilterDraft = {
  /**
   * この列のフィルターを解除し、値を `undefined` にする（初期状態には戻さない）。
   * この列の反映を待っている入力だけを捨て、他の列と一覧検索の値・入力は残す。
   */
  clearFilter: () => void
  /** この列の入力欄に表示する値。有効な下書きがあればその値、なければ確定値。 */
  getFilterInputValue: () => unknown
  /** この列の下書きを書く。更新関数は入力欄に表示している値を受け取る。確定はしない。 */
  setFilterDraft: (updater: Updater<unknown>) => void
  /**
   * 有効な下書きを確定値にし、下書きを消す。下書きが無効なら消すだけにする。
   * @param toFilterValue - 下書きから確定値を作る。省略時は下書きの値をそのまま使う
   */
  commitFilterDraft: (toFilterValue?: (draft: unknown) => unknown) => void
  /** この列の下書きを、確定せずに捨てる。 */
  discardFilterDraft: () => void
}

declare module '@tanstack/react-table' {
  interface Plugins {
    filterDraftFeature: TableFeature
  }
  interface TableState_FeatureMap {
    filterDraftFeature: TableState_FilterDraft
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    filterDraftFeature: TableOptions_FilterDraft
  }
  interface Table_FeatureMap<in out TFeatures extends TableFeatures, in out TData extends RowData> {
    filterDraftFeature: Table_FilterDraft
  }
  interface Column_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    filterDraftFeature: Column_FilterDraft
  }
}

const initialFilterDrafts: FilterDrafts = { columns: {} }

// feature の lifecycle は機能型を知らないため、この feature が登録する状態・操作と、
// 依存する組み込みの操作だけを持つ形として扱う。
type FilterDraftTable = {
  options: TableOptions_FilterDraft
  atoms: { filterDrafts: { get: () => FilterDrafts }; globalFilter: { get: () => unknown } }
  resetColumnFilters: (defaultState?: boolean) => void
  resetGlobalFilter: (defaultState?: boolean) => void
  setGlobalFilter: (updater: Updater<unknown>) => void
}
type FilterDraftColumn = {
  id: string
  table: FilterDraftTable
  getFilterValue: () => unknown
  setFilterValue: (updater: Updater<unknown>) => void
}

/**
 * 下書きが有効か（書き始めた後に確定値が外から変わっていないか）を返す。
 * @param draft - 下書き。ない場合は `undefined`
 * @param filterValue - 現在の確定値
 * @returns 有効な下書きなら `true`
 */
function isValidDraft(draft: FilterDraft | undefined, filterValue: unknown): draft is FilterDraft {
  return draft !== undefined && Object.is(draft.base, filterValue)
}

/**
 * 更新関数を、入力欄に表示している値に重ねた下書きを作る。
 *
 * @remarks
 * 有効な下書きがあれば、その値と書き始めの確定値を引き継ぐ。なければ現在の確定値から書き始める。
 * @param draft - 現在の下書き
 * @param filterValue - 現在の確定値
 * @param updater - 入力欄の値の更新
 * @returns 新しい下書き
 */
function nextDraft(
  draft: FilterDraft | undefined,
  filterValue: unknown,
  updater: Updater<unknown>,
): FilterDraft {
  const valid = isValidDraft(draft, filterValue)
  return {
    value: functionalUpdate(updater, valid ? draft.value : filterValue),
    base: valid ? draft.base : filterValue,
  }
}

/**
 * 下書きの状態を更新する。
 * @param table - この feature を登録したテーブル
 * @param update - 現在の下書きから新しい下書きを作る
 */
function updateDrafts(table: FilterDraftTable, update: (drafts: FilterDrafts) => FilterDrafts) {
  table.options.onFilterDraftsChange?.((old) => update(old))
}

/**
 * 1列の下書きを除いた下書きを返す。
 * @param drafts - 現在の下書き
 * @param columnId - 除く列の ID
 * @returns その列の下書きがなければ `drafts` 自身、あれば新しい下書き
 */
function withoutColumnDraft(drafts: FilterDrafts, columnId: string): FilterDrafts {
  if (!(columnId in drafts.columns)) return drafts
  const { [columnId]: _removed, ...columns } = drafts.columns
  return { ...drafts, columns }
}

/**
 * 一覧検索の下書きを除いた下書きを返す。
 * @param drafts - 現在の下書き
 * @returns 一覧検索の下書きがなければ `drafts` 自身、あれば新しい下書き
 */
function withoutGlobalDraft(drafts: FilterDrafts): FilterDrafts {
  if (drafts.globalFilter === undefined) return drafts
  return { columns: drafts.columns }
}

/**
 * 反映を待っている入力（下書き）をテーブルの状態として持ち、下書きごと絞り込みを解除する
 * TanStack Table の feature。
 *
 * @remarks
 * 入力欄は下書きを表示し、待機の後に `commit*` で確定値にする。解除の操作は下書きと確定値を
 * 同時に戻すため、待機中の確定は下書きがなく何もしない。`table.reset()` では下書きも初期値に戻る。
 * 確定値が外から変わった場合は、書き始めの確定値と比べて下書きを無効にする（ADR 0011）。
 * `columnFilteringFeature` と `globalFilteringFeature` の後に登録する。
 */
export const filterDraftFeature: TableFeature = {
  getInitialState: (state) => ({ filterDrafts: initialFilterDrafts, ...state }),
  getDefaultTableOptions: (table) => ({
    onFilterDraftsChange: makeStateUpdater('filterDrafts', table),
  }),
  constructTableAPIs: (table) => {
    const draftTable = table as unknown as FilterDraftTable
    const clearDrafts = () => updateDrafts(draftTable, () => initialFilterDrafts)
    const getGlobalDraft = () => draftTable.atoms.filterDrafts.get().globalFilter
    assignTableAPIs('filterDraftFeature', table, {
      table_clearFilters: {
        fn: () => {
          clearDrafts()
          draftTable.resetColumnFilters(true)
          draftTable.resetGlobalFilter(true)
        },
      },
      table_clearColumnFilters: {
        fn: () => {
          clearDrafts()
          draftTable.resetColumnFilters(true)
        },
      },
      table_clearGlobalFilter: {
        fn: () => {
          clearDrafts()
          draftTable.resetGlobalFilter(true)
        },
      },
      table_getGlobalFilterInputValue: {
        fn: () => {
          const filterValue = draftTable.atoms.globalFilter.get()
          const draft = getGlobalDraft()
          return isValidDraft(draft, filterValue) ? draft.value : filterValue
        },
      },
      table_setGlobalFilterDraft: {
        fn: (updater: Updater<unknown>) =>
          updateDrafts(draftTable, (drafts) => ({
            ...drafts,
            globalFilter: nextDraft(
              drafts.globalFilter,
              draftTable.atoms.globalFilter.get(),
              updater,
            ),
          })),
      },
      table_commitGlobalFilterDraft: {
        fn: (toFilterValue: (draft: unknown) => unknown = (draft) => draft) => {
          const draft = getGlobalDraft()
          if (draft === undefined) return
          if (isValidDraft(draft, draftTable.atoms.globalFilter.get())) {
            draftTable.setGlobalFilter(toFilterValue(draft.value))
          }
          updateDrafts(draftTable, withoutGlobalDraft)
        },
      },
      table_discardGlobalFilterDraft: {
        fn: () => updateDrafts(draftTable, withoutGlobalDraft),
      },
    })
  },
  assignColumnPrototype: (prototype, table) => {
    assignPrototypeAPIs('filterDraftFeature', prototype, table, {
      column_clearFilter: {
        fn: (column: FilterDraftColumn) => {
          updateDrafts(column.table, (drafts) => withoutColumnDraft(drafts, column.id))
          column.setFilterValue(undefined)
        },
      },
      column_getFilterInputValue: {
        fn: (column: FilterDraftColumn) => {
          const filterValue = column.getFilterValue()
          const draft = column.table.atoms.filterDrafts.get().columns[column.id]
          return isValidDraft(draft, filterValue) ? draft.value : filterValue
        },
      },
      column_setFilterDraft: {
        fn: (column: FilterDraftColumn, updater: Updater<unknown>) =>
          updateDrafts(column.table, (drafts) => ({
            ...drafts,
            columns: {
              ...drafts.columns,
              [column.id]: nextDraft(drafts.columns[column.id], column.getFilterValue(), updater),
            },
          })),
      },
      column_commitFilterDraft: {
        fn: (
          column: FilterDraftColumn,
          toFilterValue: (draft: unknown) => unknown = (draft) => draft,
        ) => {
          const draft = column.table.atoms.filterDrafts.get().columns[column.id]
          if (draft === undefined) return
          if (isValidDraft(draft, column.getFilterValue())) {
            column.setFilterValue(toFilterValue(draft.value))
          }
          updateDrafts(column.table, (drafts) => withoutColumnDraft(drafts, column.id))
        },
      },
      column_discardFilterDraft: {
        fn: (column: FilterDraftColumn) =>
          updateDrafts(column.table, (drafts) => withoutColumnDraft(drafts, column.id)),
      },
    })
  },
}
