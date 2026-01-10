import type { FilterFn, RowData } from '@tanstack/react-table'
import type { RankingInfo } from '@tanstack/match-sorter-utils'

declare module '@tanstack/react-table' {
  /**
   *
   * サンプルコードにあるような次のような拡張を宣言すると以下の1, 2の型エラーが発生する。
   * それを回避するために TableOptions の filterFns を拡張する。
   *
   * ``` ts
   * interface FilterFns {
   *   fuzzy: FilterFn<unknown>
   * }
   * ```
   *
   * 1. useReactTable のオプション filterFns に fuzzy を指定しないと型エラーが発生する。
   * ```
   * const table = useReactTable({
   *   data,
   *   filterFns: {
   *   },
   *   ...
   * }
   * ```
   *
   * 2. useReactTable のオプション filterFns を指定しないと型エラーが発生する。
   * ```
   * const table = useReactTable({
   *   data,
   *   ...
   * }
   * ```
   */
  interface TableOptions<TData extends RowData> {
    filterFns?: FilterFns | {}
  }

  interface FilterFns {
    fuzzy: FilterFn<unknown>
  }

  interface FilterMeta {
    itemRank: RankingInfo
  }

  // 列のカスタムプロパティを定義できるようにします
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: 'text' | 'range' | 'select'
  }
}
