import { useId, useMemo, useState } from 'react'

import type { ColumnDef, RowData, TableOptions } from '@tanstack/react-table'

import { getCapabilityTableOptions, resolveCapabilities } from './capabilities'
import type { TableCapabilities } from './capabilities'
import { selectBodyState } from './features'
import type { DataTableFeatures, DataTableMeta, TableLayout } from './features'
import type { DataTableApp } from './use-app-table'
import { usePageResetPolicy } from './use-page-reset-policy'

// 列ごとに値の型が異なるため、TanStack Table の TValue はこの境界でだけ緩める。
/** 共通テーブルに渡す列定義。 */
export type DataTableColumnDef<
  TData extends RowData,
  TMeta extends object = Record<never, never>,
> = ColumnDef<DataTableFeatures<TMeta>, TData, any>

/** 行選択の能力で先頭に追加する列の ID。 */
export const rowSelectionColumnId = '__select__'

/** 行の固定の能力で末尾に追加する列の ID。 */
export const rowPinningColumnId = '__pin__'

const defaultPageSizeOptions = [10, 20, 50, 100, Infinity]

// テーブルの状態ではなく、表示部品が持つ表示設定の既定値
const defaultLayout: TableLayout = {
  groupedColumnMode: 'reorder',
  fullWidth: false,
  tableFixed: true,
  showColumnFilters: false,
  showColumnPinningButtons: false,
  showColumnGroupingButtons: false,
  showRowSelectionColumn: true,
  showRowPinningColumn: false,
  heightStrategy: 'fill',
  height: 480,
}

/** 既定の `useDataTable` と factory の `useDataTable` に共通する、meta 以外のオプション。 */
export type DataTableBaseOptions<
  TData extends RowData,
  TMeta extends object = Record<never, never>,
> = {
  /** 表示する列。行選択・行の固定の列は能力に応じて加えるため含めない。参照を保つ。 */
  columns: ReadonlyArray<DataTableColumnDef<TData, TMeta>>
  /** 各要素を1行として表示するデータ。 */
  data: TData[]
  /**
   * 使う能力。`true` を指定した能力だけが有効になり、省略した表は能力を持たない表示だけの表になる。
   * すべての能力を使う表は `allCapabilities` を渡す。
   * 無効にした能力の状態は既定値に戻し、再有効化しても復元しない。
   */
  capabilities?: Partial<TableCapabilities>
  /**
   * テーブルの初期状態。マウント時に1回だけ読む。無効な能力の状態は使わない。
   * 操作列の可視性はここで指定せず、initialLayout で指定する。
   */
  initialState?: TableOptions<DataTableFeatures<TMeta>, TData>['initialState']
  /** 行 ID の決め方。省略時は行の位置を ID にする。 */
  getRowId?: TableOptions<DataTableFeatures<TMeta>, TData>['getRowId']
  /** 1ページの件数の選択肢。`Infinity` は全件を1ページに表示する。初期状態の件数は自動で加える。 */
  pageSizeOptions?: number[]
  /** 表示設定の初期値。マウント時に1回だけ読み、設定パネルのリセットでもこの値に戻す。 */
  initialLayout?: Partial<TableLayout>
  /** 列定義の既定値。登録済みの既定値（列幅など）を置き換える。 */
  defaultColumn?: Partial<DataTableColumnDef<TData, TMeta>>
  /** 列を一覧検索の対象にするか。省略時は値を持つすべての列を対象にする。 */
  getColumnCanGlobalFilter?: TableOptions<
    DataTableFeatures<TMeta>,
    TData
  >['getColumnCanGlobalFilter']
}

/** 利用側meta。`dataTable` は共通部品の予約キーのため、利用側からは設定させない。 */
export type DataTableConsumerMeta<TMeta extends object> = TMeta & { dataTable?: never }

/**
 * 既定の `useDataTable`・`DataTable` のオプション。利用側metaは受け取らない。
 * metaを渡す表は `createDataTableFactory` の `DataTableFactoryOptions` を使う。
 */
export type DataTableOptions<TData extends RowData> = DataTableBaseOptions<TData> & {
  meta?: never
}

/**
 * 選んだ能力を持つテーブルを作る。描画は `DataTableView` に渡して行う。
 *
 * @remarks
 * 呼び出し側は行の並び・見出しの構成に関わる状態（並び替え・絞り込み・ページ・列の表示や固定・行の固定など）を
 * 購読し、その変更で描画し直す。描画中に `table.state` や `table.getPrePaginatedRowModel()` を読める。
 * 行選択・セル選択・列幅の変更では描画し直さないため、それらは `table.Subscribe` で読む。
 *
 * 能力に応じて行選択の列を先頭に、行の固定の列を末尾に加える。渡した列の配列は変更しない。
 *
 * @param app - 同じmeta型に結び付けたTanStackのフックと部品登録
 * @param options - 表示する行・列と能力・初期状態・利用側meta
 * @returns `DataTableView` に渡すテーブル
 */
export function useDataTableInstance<TData extends RowData, TMeta extends object>(
  app: DataTableApp<TMeta>,
  {
    meta: consumerMeta,
    columns,
    data,
    capabilities: capabilitiesOption,
    initialState,
    getRowId,
    pageSizeOptions = defaultPageSizeOptions,
    initialLayout: initialLayoutOption,
    defaultColumn,
    getColumnCanGlobalFilter,
  }: DataTableBaseOptions<TData, TMeta> & { meta: TMeta },
) {
  const capabilities = resolveCapabilities(capabilitiesOption)
  // 表示設定の初期値はマウント時だけ読み、リセットでもこの値に戻す
  const [initialLayout] = useState<TableLayout>(() => ({
    ...defaultLayout,
    ...initialLayoutOption,
  }))
  const [layout, setLayout] = useState(initialLayout)
  // 通常列の可視性だけを所有し、操作列は表示設定から合成する。
  const [columnVisibilityState, setColumnVisibilityState] = useState(() => ({
    enabled: capabilities.columnVisibility,
    columns: capabilities.columnVisibility
      ? getDataColumnVisibility(initialState?.columnVisibility ?? {})
      : {},
  }))
  // 能力を無効にした時点で通常列の状態を破棄し、再有効化しても復元しない。
  if (columnVisibilityState.enabled !== capabilities.columnVisibility) {
    setColumnVisibilityState({
      enabled: capabilities.columnVisibility,
      columns: capabilities.columnVisibility ? columnVisibilityState.columns : {},
    })
  }
  const columnVisibility = {
    // 無効にした直後の描画は上の setState で作り直されるが、その描画でも useAppTable は
    // テーブルへ options を書き込むため、破棄前の状態を渡さないよう能力でも判定する
    ...(capabilities.columnVisibility ? columnVisibilityState.columns : {}),
    [rowSelectionColumnId]: layout.showRowSelectionColumn,
    [rowPinningColumnId]: layout.showRowPinningColumn,
  }
  const capabilityOptions = getCapabilityTableOptions(capabilities)
  const idPrefix = useId()

  // 列の参照が変わると行モデルを作り直すため、追加する列に関わる能力が変わったときだけ作り直す
  const tableColumns = useMemo(
    () => withCapabilityColumns(app, columns, capabilities.rowSelection, capabilities.rowPinning),
    [app, columns, capabilities.rowSelection, capabilities.rowPinning],
  )
  // 初期状態はマウント時だけ読まれるため、最初の能力で1回だけ作る
  const [tableInitialState] = useState(() => withCapabilityInitialState(initialState, capabilities))

  const internalMeta: DataTableMeta = {
    capabilities,
    layout,
    onChangeLayout: (patch) => setLayout((prev) => ({ ...prev, ...patch })),
    onResetLayout: () => setLayout(initialLayout),
    pageSizeOptions,
    idPrefix,
  }

  // 行の並びとヘッダーの構成に関わる状態だけを購読する。
  // 選択・列幅などは各行・各ヘッダー・各部品の購読で反映する。
  const table = app.useAppTable<TData, ReturnType<typeof selectBodyState>>(
    {
      columns: tableColumns,
      data,
      getRowId,
      initialState: tableInitialState,
      groupedColumnMode: layout.groupedColumnMode,
      // undefined を渡すと既定値を上書きするため、指定時だけ渡す
      ...(defaultColumn && { defaultColumn }),
      ...(getColumnCanGlobalFilter && { getColumnCanGlobalFilter }),
      ...capabilityOptions,
      // 行の内容の更新と、利用者による表示条件の変更を区別する。
      autoResetPageIndex: false,
      autoResetExpanded: !getRowId,
      autoResetCellSelection: !getRowId,
      state: { ...capabilityOptions.state, columnVisibility },
      onColumnVisibilityChange: (updater) => {
        if (!capabilities.columnVisibility) return
        setColumnVisibilityState((old) => ({
          ...old,
          columns: getDataColumnVisibility(
            typeof updater === 'function' ? updater(old.columns) : updater,
          ),
        }))
      },
      meta: { ...consumerMeta, dataTable: internalMeta },
    },
    selectBodyState,
  )
  usePageResetPolicy(table, capabilities.pagination)
  return table
}

/** {@link useDataTable} が返すテーブル。 */
export type DataTableInstance<
  TData extends RowData,
  TMeta extends object = Record<never, never>,
> = ReturnType<typeof useDataTableInstance<TData, TMeta>>

/**
 * 能力に応じて、行選択の列を先頭に、行の固定の列を末尾に加える。
 *
 * @remarks
 * 操作列の表示はテーブル設定が所有する。一般列と同じく列幅の変更・列の固定ができる。
 * 初期幅・最小幅と表示名（`meta.label`）は列ごとに指定し、`defaultColumn` より優先する。
 * セル選択の対象にはしない。
 *
 * @param app - 操作列に登録済みの部品を結び付けるfactory
 * @param columns - 利用側の列
 * @param rowSelection - 行選択の列を加えるなら `true`
 * @param rowPinning - 行の固定の列を加えるなら `true`
 * @returns 加える列がなければ `columns` 自身、あれば新しい配列
 */
function withCapabilityColumns<TData extends RowData, TMeta extends object>(
  app: DataTableApp<TMeta>,
  columns: ReadonlyArray<DataTableColumnDef<TData, TMeta>>,
  rowSelection: boolean,
  rowPinning: boolean,
) {
  if (!rowSelection && !rowPinning) return columns

  const columnHelper = app.createAppColumnHelper<TData>()
  const columnsWithCapabilities: Array<DataTableColumnDef<TData, TMeta>> = [...columns]

  if (rowSelection) {
    columnsWithCapabilities.unshift(
      columnHelper.display({
        id: rowSelectionColumnId,
        size: 32,
        // defaultColumn の minSize より狭くするため、列ごとに指定する。チェックボックスと余白が収まる幅
        minSize: 32,
        enableHiding: false,
        enableCellSelection: false,
        meta: { label: '行選択' },
        header: ({ header }) => <header.SelectAllRowsCheckbox />,
        cell: ({ cell }) => <cell.RowSelectCheckbox />,
      }),
    )
  }

  if (rowPinning) {
    columnsWithCapabilities.push(
      columnHelper.display({
        id: rowPinningColumnId,
        header: '固定',
        size: 64,
        // 上端・下端の2つのボタンと余白が収まる幅。defaultColumn の minSize によらず列ごとに指定する
        minSize: 60,
        enableHiding: false,
        enableCellSelection: false,
        meta: { label: '行の固定' },
        cell: ({ cell }) => <cell.RowPinButtons />,
      }),
    )
  }

  return columnsWithCapabilities
}

/**
 * 能力に合わせて、テーブルに渡す初期状態を作る。
 *
 * @remarks
 * `enable*` オプションは操作を止めるだけで、状態は適用されるため、
 * 無効な能力の初期状態（列の固定など）は取り除く。
 *
 * @param initialState - 利用側の初期状態
 * @param capabilities - すべての能力を持つオブジェクト
 * @returns 新しい初期状態のオブジェクト。`initialState` は変更しない
 */
function withCapabilityInitialState<TData extends RowData, TMeta extends object>(
  initialState: DataTableBaseOptions<TData, TMeta>['initialState'],
  capabilities: TableCapabilities,
) {
  const nextInitialState = { ...initialState }
  const disabledState = getCapabilityTableOptions(capabilities).state
  for (const key of Object.keys(disabledState) as Array<keyof typeof disabledState>) {
    delete nextInitialState[key]
  }
  return nextInitialState
}

/**
 * 操作列のキーを除き、通常列の可視性だけを取り出す。
 * @param visibility - 初期値または列表示操作による可視性
 * @returns 操作列を含まない新しい可視性オブジェクト
 */
function getDataColumnVisibility(visibility: Record<string, boolean>) {
  return Object.fromEntries(
    Object.entries(visibility).filter(
      ([id]) => id !== rowSelectionColumnId && id !== rowPinningColumnId,
    ),
  )
}
