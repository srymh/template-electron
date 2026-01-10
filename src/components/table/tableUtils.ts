import { sortingFns } from '@tanstack/react-table'
import { compareItems, rankItem } from '@tanstack/match-sorter-utils'

import type { FilterFn, FilterMeta, SortingFn } from '@tanstack/react-table'

// カスタムのファジーフィルタ関数を定義（match-sorter utilsを使って行にランキング情報を適用）
export const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  // アイテムのランク付け
  const itemRank = rankItem(row.getValue(columnId), value)

  // itemRank情報を保存
  addMeta({
    itemRank,
  })

  // このアイテムをフィルタに含めるかどうかを返す
  return itemRank.passed
}

// カスタムのファジーソート関数を定義（行にランキング情報がある場合はランクでソート）
export const fuzzySort: SortingFn<any> = (rowA, rowB, columnId) => {
  let dir = 0

  const columnFilterMetaA = rowA.columnFiltersMeta[columnId] as
    | FilterMeta
    | undefined
  const columnFilterMetaB = rowB.columnFiltersMeta[columnId] as
    | FilterMeta
    | undefined

  // 列にランキング情報がある場合のみランクでソート
  if (columnFilterMetaA && columnFilterMetaB) {
    dir = compareItems(columnFilterMetaA.itemRank, columnFilterMetaB.itemRank)
  }

  // ランクが同じ場合は英数字順でソート
  return dir === 0 ? sortingFns.alphanumeric(rowA, rowB, columnId) : dir
}
