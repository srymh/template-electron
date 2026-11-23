import { createTableHook } from '@tanstack/react-table'
import type { AppColumnHelper, RowData } from '@tanstack/react-table'

import { createBodyCell } from './body/body-cell'
import { createBodyRow } from './body/body-row'
import { createRowControls } from './body/row-controls'
import { createDataTableContexts } from './contexts'
import { createDataTableFeatures } from './features'
import { createFrame } from './frame/table-frame'
import { createHead } from './header/head'
import { createHeaderCell } from './header/header-cell'

/**
 * すべての機能と、テーブル・見出し・セルの描画部品を登録した `useAppTable` と列ヘルパー。
 *
 * @remarks
 * 部品はスコープ付きのコンテキスト（`./contexts`）からテーブル・見出し・セルを読む。
 * どの部品も `useDataTable` が渡す `meta.dataTable`（`DataTableMeta`）を前提にするため、
 * 利用側は `useDataTable` と `DataTableView`（または `DataTable`）を通して使う。
 *
 * 全テーブル共通の既定値として、あいまい検索の一覧検索、ドラッグ中に反映する列幅の変更、
 * 列幅の既定値・最小値を設定する。
 * @returns 同じ機能型のフック・列ヘルパー・部品を持つTanStackのfactory
 */
export function createAppTable<TMeta extends object>() {
  const features = createDataTableFeatures<TMeta>()
  const contexts = createDataTableContexts<TMeta>()
  const { Frame } = createFrame(contexts)
  const { Head } = createHead(contexts)
  const { BodyRow } = createBodyRow(contexts)
  const { HeaderCell } = createHeaderCell(contexts)
  const { BodyCell } = createBodyCell(contexts)
  const { RowPinButtons, RowSelectCheckbox, SelectAllRowsCheckbox } = createRowControls(contexts)
  return createTableHook({
    features,
    ...contexts,
    globalFilterFn: 'fuzzy',
    columnResizeMode: 'onChange',
    defaultColumn: {
      size: 150,
      // 見出しの操作ボタンと、縮めた列フィルターの入力欄が収まる幅
      minSize: 64,
    },
    tableComponents: {
      Frame,
      Head,
      BodyRow,
    },
    headerComponents: {
      Cell: HeaderCell,
      SelectAllRowsCheckbox,
    },
    cellComponents: {
      Cell: BodyCell,
      RowSelectCheckbox,
      RowPinButtons,
    },
  })
}

/** factoryに結び付けたTanStackのフックと部品登録。 */
export type DataTableApp<TMeta extends object> = ReturnType<typeof createAppTable<TMeta>>

/**
 * factory の列ヘルパー（`createDataTableColumnHelper<TData>()` の返り値）の型。
 *
 * @remarks
 * 登録した部品の型を factory の列ヘルパーから取り出し、行データの型だけを差し替える。
 * 列を作る関数を複数の factory で共有するとき、引数の型に使う。
 */
export type DataTableColumnHelper<
  TData extends RowData,
  TMeta extends object = Record<never, never>,
> =
  ReturnType<DataTableApp<TMeta>['createAppColumnHelper']> extends AppColumnHelper<
    infer TFeatures,
    RowData,
    infer TCellComponents,
    infer THeaderComponents
  >
    ? AppColumnHelper<TFeatures, TData, TCellComponents, THeaderComponents>
    : never
