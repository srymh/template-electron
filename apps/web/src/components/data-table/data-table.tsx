import type { RowData } from '@tanstack/react-table'

import type { DataTableViewProps } from './create-data-table-view'
import { defaultDataTableFactory } from './default-factory'
import type { DataTableOptions } from './use-data-table-instance'

/** 既定の {@link DataTable} の props。テーブルのオプションと表示の props を持つ。 */
export type DataTableProps<TData extends RowData> = DataTableOptions<TData> &
  DataTableViewProps<TData>

/** 既定のfactoryのテーブルを操作行・見出し・本文で表示する。 */
export const DataTableView = defaultDataTableFactory.DataTableView

/** 行・列・能力から、利用側metaを持たない一覧を表示する。 */
export function DataTable<TData extends RowData>(props: DataTableProps<TData>) {
  return <defaultDataTableFactory.DataTable {...props} meta={{}} />
}

export type { DataTableViewProps } from './create-data-table-view'
