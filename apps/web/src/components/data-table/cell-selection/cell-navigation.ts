import type {
  Cell_CellSelection,
  CellSelectionDirection,
  CellSelectionState,
} from '@tanstack/react-table'

/** 表示グリッド内の位置と、選択できるかの判定を持つセル。 */
export type NavigationCell = Pick<Cell_CellSelection, 'getCanSelect'> & {
  row: { id: string }
  column: { id: string }
}

/** 実際に描画する行順・列順に並べたセル。非表示の行・列は含めない。 */
export type CellNavigationGrid = ReadonlyArray<ReadonlyArray<NavigationCell>>

type Coordinates = { rowId: string; columnId: string }

/**
 * Tab で到達させる選択可能なセルを返す。
 * @param grid - 実際に描画するセルのグリッド
 * @param focusedCell - 現在の選択起点。画面外または選択不可なら代替を探す
 * @returns 選択起点、または表示順で最初の選択可能なセル。なければ undefined
 */
export function getCellTabStop(grid: CellNavigationGrid, focusedCell?: NavigationCell) {
  if (focusedCell) {
    const visible = findCell(grid, {
      rowId: focusedCell.row.id,
      columnId: focusedCell.column.id,
    })
    if (visible?.getCanSelect()) return visible
  }
  for (const cells of grid) {
    const first = cells.find((cell) => cell.getCanSelect())
    if (first) return first
  }
  return undefined
}

/**
 * 表示グリッド内で矢印キーによる選択移動・範囲拡張を計算する。
 * @param grid - 固定行・固定列を含む、実際の表示順のセル
 * @param current - キー入力を受けたセル
 * @param direction - 移動方向。画面端を越える移動は行わない
 * @param extend - true なら選択起点を保ち、最後の範囲の終点を移動する
 * @param selection - 現在の選択範囲。画面外の起点は current で置き換える
 * @returns 移動後の選択。移動先がなければ元の selection 自身
 */
export function navigateCellSelection(
  grid: CellNavigationGrid,
  current: NavigationCell,
  direction: CellSelectionDirection,
  extend: boolean,
  selection: CellSelectionState,
): CellSelectionState {
  const active = extend ? selection.at(-1) : undefined
  const anchor =
    active &&
    findCell(grid, {
      rowId: active.anchorRowId,
      columnId: active.anchorColumnId,
    })
  const focus =
    active &&
    findCell(grid, {
      rowId: active.focusRowId,
      columnId: active.focusColumnId,
    })
  const canExtend = anchor?.getCanSelect() && focus?.getCanSelect()
  const from = canExtend && focus ? focus : current
  const rowIndex = grid.findIndex((cells) => cells.some((cell) => cell.row.id === from.row.id))
  if (rowIndex < 0 || !current.getCanSelect()) return selection

  const vertical = direction === 'up' || direction === 'down'
  const step = direction === 'up' || direction === 'left' ? -1 : 1
  const cells = grid[rowIndex]
  let index = vertical ? rowIndex : cells.findIndex((cell) => cell.column.id === from.column.id)
  if (index < 0) return selection

  // 選択不可のセルは飛ばす。縦移動では同じ列を保ち、横移動では行を保つ。
  while (true) {
    index += step
    if (index < 0 || index >= (vertical ? grid.length : cells.length)) return selection
    const target = vertical
      ? grid[index].find((cell) => cell.column.id === from.column.id)
      : cells[index]
    if (!target?.getCanSelect()) continue

    const endpoint = { focusRowId: target.row.id, focusColumnId: target.column.id }
    if (canExtend && active) {
      return [...selection.slice(0, -1), { ...active, ...endpoint }]
    }
    return [
      {
        anchorRowId: extend ? current.row.id : target.row.id,
        anchorColumnId: extend ? current.column.id : target.column.id,
        ...endpoint,
      },
    ]
  }
}

function findCell(grid: CellNavigationGrid, { rowId, columnId }: Coordinates) {
  return grid
    .find((cells) => cells.some((cell) => cell.row.id === rowId))
    ?.find((cell) => cell.column.id === columnId)
}
