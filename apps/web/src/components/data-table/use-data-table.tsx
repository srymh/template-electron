import type { RowData } from '@tanstack/react-table'

import { defaultDataTableFactory } from './default-factory'
import type { DataTableOptions } from './use-data-table-instance'

/** 既定の機能・部品を使う列ヘルパー。列の参照は構造が変わるまで保つ。 */
export const createDataTableColumnHelper = defaultDataTableFactory.createDataTableColumnHelper

/**
 * 利用側metaを持たない既定のテーブルを作る。
 * @param options - 行・列・能力・表示設定
 * @returns DataTableViewに渡すテーブル
 */
export function useDataTable<TData extends RowData>(options: DataTableOptions<TData>) {
  return defaultDataTableFactory.useDataTable({ ...options, meta: {} })
}

export { rowSelectionColumnId, rowPinningColumnId } from './use-data-table-instance'
export type {
  DataTableColumnDef,
  DataTableInstance,
  DataTableOptions,
} from './use-data-table-instance'
