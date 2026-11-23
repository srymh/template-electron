import { useLayoutEffect, useRef } from 'react'

import type { RowData } from '@tanstack/react-table'

import type { DataTableInstance } from './use-data-table-instance'

/**
 * 行の内容の差し替えと、表示条件の変更を区別してページ位置を補正する。
 * @param table - 表示条件とページ状態を購読したテーブル
 * @param enabled - ページ分割の能力が有効か
 * @returns 値は返さず、条件変更とページ数の減少を描画前に反映する
 */
export function usePageResetPolicy<TData extends RowData, TMeta extends object>(
  table: DataTableInstance<TData, TMeta>,
  enabled: boolean,
) {
  const { sorting, columnFilters, globalFilter, grouping, pagination } = table.state
  const previousConditions = useRef({ sorting, columnFilters, globalFilter, grouping })
  const pageCount = enabled ? table.getPageCount() : 1

  useLayoutEffect(() => {
    const previous = previousConditions.current
    const conditionsChanged =
      previous.sorting !== sorting ||
      previous.columnFilters !== columnFilters ||
      previous.globalFilter !== globalFilter ||
      previous.grouping !== grouping
    previousConditions.current = { sorting, columnFilters, globalFilter, grouping }
    if (!enabled) return

    // Tableが所有する条件の変更だけで先頭へ戻す。行の内容の更新では現在位置を保つ。
    const lastPageIndex = Math.max(0, pageCount - 1)
    const nextPageIndex = conditionsChanged ? 0 : Math.min(pagination.pageIndex, lastPageIndex)
    if (nextPageIndex !== pagination.pageIndex) table.setPageIndex(nextPageIndex)
  }, [
    table,
    enabled,
    sorting,
    columnFilters,
    globalFilter,
    grouping,
    pagination.pageIndex,
    pageCount,
  ])
}
