import type { RowData, Table } from '@tanstack/react-table'

import { createDataTableView } from './create-data-table-view'
import type { DataTableViewProps } from './create-data-table-view'
import type { DataTableFeatures } from './features'
import { createAppTable } from './use-app-table'
import { useDataTableInstance } from './use-data-table-instance'
import type { DataTableBaseOptions, DataTableConsumerMeta } from './use-data-table-instance'

/** factoryの `useDataTable` のオプション。利用側metaは必須。 */
export type DataTableFactoryOptions<
  TData extends RowData,
  TMeta extends object,
> = DataTableBaseOptions<TData, TMeta> & {
  /** セル・見出しの関数へ渡す、画面の値と操作。`dataTable` は予約キーのため含めない。 */
  meta: DataTableConsumerMeta<TMeta>
}

/** factoryの `DataTable` の props。テーブルのオプションと表示の props を持つ。 */
export type DataTableFactoryProps<
  TData extends RowData,
  TMeta extends object,
> = DataTableFactoryOptions<TData, TMeta> & DataTableViewProps<TData, TMeta>

/**
 * 利用側metaの型と共通の機能・部品を結び付けたテーブルfactoryを作る。
 * モジュールの最上位で1回だけ作り、描画中には呼ばない。
 * @returns 型付きのmetaを受け取るフック、描画部品、列ヘルパー、metaの取り出し口
 */
export function createDataTableFactory<TMeta extends object>() {
  const app = createAppTable<TMeta>()
  const DataTableView = createDataTableView<TMeta>()

  /**
   * 参照を保つ列と変化するmetaからテーブルを作る。
   * @param options - 行・列・共通設定と必須の利用側meta
   * @returns 同じfactoryのDataTableViewへ渡すテーブル
   */
  function useDataTable<TData extends RowData>(options: DataTableFactoryOptions<TData, TMeta>) {
    return useDataTableInstance<TData, TMeta>(app, options)
  }

  /** 列・行・metaから、操作行・見出し・本文を持つ一覧を表示する。 */
  function DataTable<TData extends RowData>({
    label,
    toolbar,
    getRowProps,
    settings,
    ...options
  }: DataTableFactoryProps<TData, TMeta>) {
    const table = useDataTable(options)
    return (
      <DataTableView
        table={table}
        label={label}
        toolbar={toolbar}
        getRowProps={getRowProps}
        settings={settings}
      />
    )
  }

  /**
   * セル・見出しの関数が受け取るテーブルから、利用側metaを取り出す。
   *
   * @remarks
   * セル関数の中で読み、子には読んだ値をpropsで渡す。共通部品の内部値（`dataTable`）は型に含めない。
   * @param table - 同じfactoryで作ったテーブル（セル・見出しの関数の引数の `table`）
   * @returns 利用側metaの最新の値
   * @throws metaがない場合（同じfactoryの `useDataTable` で作っていないテーブルを渡した場合）
   */
  function getMeta<TData extends RowData>(table: Table<DataTableFeatures<TMeta>, TData>): TMeta {
    const meta = table.options.meta
    if (!meta) throw new Error('利用側metaは、同じfactoryの useDataTable で作ったテーブルから読む')
    return meta
  }

  return {
    useDataTable,
    DataTableView,
    DataTable,
    createDataTableColumnHelper: app.createAppColumnHelper,
    getMeta,
  }
}
