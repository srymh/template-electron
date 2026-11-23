import type { Cell, Row } from '@tanstack/react-table'

import { getCellTabStop } from '../cell-selection/cell-navigation'
import { getNavigationGrid } from '../cell-selection/navigation-grid'
import { getDisplayCells, getDisplayColumns } from '../display-order'
import { getTableMeta } from '../features'
import type { ComponentRowData, DataTableCoreTable, DataTableFeatures } from '../features'

/**
 * factoryごとに描画状態の型とキャッシュを結び付ける。
 * @returns 行の変更キーと表示状態を読む処理
 */
export function createRowRenderState<TMeta extends object>() {
  type BodyRowData = Row<DataTableFeatures<TMeta>, ComponentRowData>

  /**
   * 行の描画し直しが必要かを判定するキーを返す。各要素はプリミティブで、浅い比較で変更を検知する。
   *
   * @remarks
   * {@link getRowRenderState} が返す値は、すべてこのキーの要素から決まる。
   * - セル: 列の並び・固定・幅・グループ化（全行で共通のキー）、セル選択の能力、列幅を固定するか、
   *   行の `groupingColumnId`
   * - 行: 行選択、行の固定と固定領域の端、グループ化と展開（{@link getRowOwnState} のすべての値）
   * - セル選択: 行と上下1行に重なる選択範囲・フォーカスの列（{@link getRowSelectionKey}）と、
   *   選択がないときの Tab の到達先の列
   *
   * 表示状態を読む処理を変えたときは、このキーも合わせて変える。
   *
   * @param row - 対象の行
   * @param table - 行が属するテーブル
   * @returns 描画に使う値が同じなら、要素ごとに等しい配列
   */
  function getRowChangeKey(row: BodyRowData, table: DataTableCoreTable<ComponentRowData, TMeta>) {
    const shared = getSharedRenderState(table)
    const { capabilities, layout } = getTableMeta(table)

    return [
      shared.columnsKey,
      capabilities.cellSelection,
      layout.tableFixed,
      row.groupingColumnId,
      ...Object.values(getRowOwnState(row, shared)),
      capabilities.cellSelection ? getRowSelectionKey(row, shared) : '',
      getTabStopColumnId(row, shared),
    ]
  }

  /**
   * 行と各セルの描画に使う値を、現在の状態から読み取る。
   *
   * @remarks
   * 返す値を変えたときは、{@link getRowChangeKey} が同じ変更を検知できるようにする。
   *
   * @param row - 対象の行
   * @param table - 行が属するテーブル
   * @returns 行の固定・選択・グループ化の状態と、固定領域の順に並べた
   *   表示中のセルごとの配置・グループ化・選択の状態
   */
  function getRowRenderState(row: BodyRowData, table: DataTableCoreTable<ComponentRowData, TMeta>) {
    const shared = getSharedRenderState(table)
    const { tableFixed } = getTableMeta(table).layout
    const tabStopColumnId = getTabStopColumnId(row, shared)

    return {
      ...getRowOwnState(row, shared),
      cells: getDisplayCells(row).map((cell) =>
        getCellRenderState(cell, tableFixed, cell.column.id === tabStopColumnId),
      ),
    }
  }

  /** 入力が変わるたびに表で1回だけ求める、全行で共通の表示状態。 */
  type SharedRenderState = ReturnType<typeof computeSharedRenderState>

  /** {@link computeSharedRenderState} が読む値。要素ごとに `===` で比べる。 */
  type SharedRenderInputs = ReturnType<typeof getSharedRenderInputs>

  // テーブルごとに1つ持つ。描画のたびに作り直されるテーブルのオブジェクトではなく、
  // テーブルの間は変わらない store をキーにし、無効化は入力（getSharedRenderInputs）だけで決める
  const sharedRenderStateCache = new WeakMap<
    object,
    { inputs: SharedRenderInputs; value: SharedRenderState }
  >()

  /**
   * 全行で共通の表示状態が依存する入力を返す。
   *
   * @remarks
   * 行・列の配列は TanStack Table がメモ化しており、行モデル（データを含む）・行の固定・
   * 列の定義・可視性・固定が変わらない間は同じ参照を返す。列幅・並び替え・選択などは
   * ストアの状態に含まれる。表示設定と能力は、使う値だけを比べる。
   * {@link computeSharedRenderState} が読む値を増やしたときは、ここにも加える。
   *
   * @param table - 行が属するテーブル
   * @returns ストアの状態、上端・中央・下端の行、先頭側・中央・末尾側の表示中の列、
   *   セル選択の能力、列幅を固定するか
   */
  function getSharedRenderInputs(table: DataTableCoreTable<ComponentRowData, TMeta>) {
    const { capabilities, layout } = getTableMeta(table)
    return [
      table.store.get(),
      table.getTopRows(),
      table.getCenterRows(),
      table.getBottomRows(),
      table.getStartVisibleLeafColumns(),
      table.getCenterVisibleLeafColumns(),
      table.getEndVisibleLeafColumns(),
      capabilities.cellSelection,
      layout.tableFixed,
    ] as const
  }

  /**
   * 全行で共通の表示状態を返す。入力（{@link getSharedRenderInputs}）のどれかが変わったときだけ求め直す。
   *
   * @param table - 行が属するテーブル
   * @returns 列の配置のキー、固定行の数、中央の最後の行、Tab の到達先、選択範囲
   */
  function getSharedRenderState(table: DataTableCoreTable<ComponentRowData, TMeta>) {
    const inputs = getSharedRenderInputs(table)
    const cached = sharedRenderStateCache.get(table.store)
    if (cached && cached.inputs.every((input, index) => input === inputs[index])) {
      return cached.value
    }
    const value = computeSharedRenderState(table)
    sharedRenderStateCache.set(table.store, { inputs, value })
    return value
  }

  function computeSharedRenderState(table: DataTableCoreTable<ComponentRowData, TMeta>) {
    const { capabilities, layout } = getTableMeta(table)
    // display index は表示順の行モデルを取得してから読む
    table.getRowsInDisplayOrder()

    // セルの配置・幅・グループ化は列ごとに決まるため、列の並びと各列の値を1つのキーにまとめる。
    // 列幅を固定する表の列幅は見出しのセルの幅で決まるため、本文のセルの描画に幅を使わず、キーにも含めない
    const columnsKey = JSON.stringify(
      getDisplayColumns(table).map((column) => [
        column.id,
        column.getIsPinned(),
        column.getStart('start') ?? 0,
        column.getAfter('end') ?? 0,
        layout.tableFixed ? undefined : column.getSize(),
        column.getGroupedIndex(),
        column.getIsGrouped(),
      ]),
    )
    const centerRows = table.getCenterRows()

    return {
      columnsKey,
      topRowCount: table.getTopRows().length,
      lastCenterRowId: centerRows[centerRows.length - 1]?.id,
      // 選択起点が別ページや非表示列にあっても、現在の画面へ Tab で到達できる。
      // セル選択を使わない表では、全セルを探さないよう計算を省く。
      tabStop: capabilities.cellSelection
        ? getCellTabStop(getNavigationGrid(table), table.getFocusedCell())
        : undefined,
      cellSelectionBounds: capabilities.cellSelection ? table.getCellSelectionBounds() : [],
      activeRange: table.atoms.cellSelection.get().at(-1),
    }
  }

  /**
   * 行自身の表示状態（セルを除く）を読み取る。値はすべてプリミティブで、そのまま変更キーの要素になる。
   *
   * @param row - 対象の行
   * @param shared - 全行で共通の表示状態
   * @returns 行の固定・選択・グループ化の状態
   */
  function getRowOwnState(row: BodyRowData, shared: SharedRenderState) {
    const isPinned = row.getIsPinned()
    const pinnedIndex = row.getPinnedIndex()
    return {
      isSelected: row.getIsSelected(),
      isPinned,
      isLastRowOfTop: isPinned === 'top' && pinnedIndex === shared.topRowCount - 1,
      isFirstRowOfBottom: isPinned === 'bottom' && pinnedIndex === 0,
      isLastRowOfCenter: shared.lastCenterRowId === row.id,
      isGrouped: row.getIsGrouped(),
      isExpanded: row.getIsExpanded(),
      canExpand: row.getCanExpand(),
      subRowCount: row.subRows.length,
    }
  }

  /**
   * 行が Tab の到達先のセルを持つ場合に、その列の ID を返す。
   *
   * @param row - 対象の行
   * @param shared - 全行で共通の表示状態
   * @returns Tab の到達先の列の ID。到達先が他の行にある、またはない場合は `undefined`
   */
  function getTabStopColumnId(row: BodyRowData, shared: SharedRenderState) {
    return shared.tabStop?.row.id === row.id ? shared.tabStop.column.id : undefined
  }

  /**
   * 行のセル選択の表示に関係する範囲とフォーカスを比較するキーを返す。
   *
   * @remarks
   * 選択範囲は除外を適用した後の重ならない長方形なので、対象行と上下1行に重なる範囲だけで
   * 行のセルの選択と境界線が決まる。上下の行を含めるのは、選択領域の上辺・下辺が変わった行を更新するため。
   *
   * @param row - 対象の行
   * @param shared - 全行で共通の表示状態
   * @returns 対象行と上下1行の範囲、およびフォーカスの列が同じなら同じ文字列。
   *   離れた行の選択変更では変わらない
   */
  function getRowSelectionKey(row: BodyRowData, shared: SharedRenderState) {
    const { activeRange } = shared
    const rowIndex = row.getDisplayIndex()
    const nearbyBounds = shared.cellSelectionBounds
      .filter((bound) => bound.maxRowIndex >= rowIndex - 1 && bound.minRowIndex <= rowIndex + 1)
      .map((bound) => [
        Math.max(bound.minRowIndex, rowIndex - 1),
        Math.min(bound.maxRowIndex, rowIndex + 1),
        bound.minColumnIndex,
        bound.maxColumnIndex,
      ])
    const focusedColumnId =
      activeRange?.anchorRowId === row.id ? activeRange.anchorColumnId : undefined

    return JSON.stringify([nearbyBounds, focusedColumnId])
  }

  function getCellRenderState(
    cell: Cell<DataTableFeatures<TMeta>, ComponentRowData>,
    tableFixed: boolean,
    isTabStop: boolean,
  ) {
    const { column } = cell
    const isPinned = column.getIsPinned()
    return {
      cell,
      isPinned,
      isLastColumnOfStart: isPinned === 'start' && column.getIsLastColumn('start'),
      isFirstColumnOfEnd: isPinned === 'end' && column.getIsFirstColumn('end'),
      start: column.getStart('start') ?? 0,
      after: column.getAfter('end') ?? 0,
      // 列幅を固定しない表での最小幅。固定する表の列幅は見出しのセルの幅で決まるため、持たない
      minSize: tableFixed ? undefined : column.getSize(),
      isCellGrouped: cell.getIsGrouped(),
      isPlaceholder: cell.getIsPlaceholder(),
      columnGroupedIndex: column.getGroupedIndex(),
      isCellSelected: cell.getIsSelected(),
      isFocused: cell.getIsFocused(),
      edges: cell.getSelectionEdges(),
      isTabStop,
    }
  }

  return { getRowChangeKey, getRowRenderState }
}

/** 既定の機能型で行の変更キーと表示状態を読む処理。 */
export const { getRowChangeKey, getRowRenderState } = createRowRenderState<Record<never, never>>()

/** 行の購読からセルへ渡す、同じfactoryの表示状態。 */
export type BodyCellState<TMeta extends object = Record<never, never>> = {
  row: ReturnType<ReturnType<typeof createRowRenderState<TMeta>>['getRowRenderState']>
  cell: ReturnType<
    ReturnType<typeof createRowRenderState<TMeta>>['getRowRenderState']
  >['cells'][number]
}
