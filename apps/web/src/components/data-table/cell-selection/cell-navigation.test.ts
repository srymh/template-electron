import { describe, expect, it } from 'vitest'
import type { CellSelectionState } from '@tanstack/react-table'

import { getCellTabStop, navigateCellSelection } from './cell-navigation'
import type { CellNavigationGrid, NavigationCell } from './cell-navigation'

function cell(rowId: string, columnId: string, selectable = true): NavigationCell {
  return { row: { id: rowId }, column: { id: columnId }, getCanSelect: () => selectable }
}

// 行 ID の順と表示順を意図的に変え、ページ外の固定行も含むグリッドを使う。
function createGrid(): CellNavigationGrid {
  return ['top', 'page-3', 'page-2', 'bottom'].map((rowId) => [
    cell(rowId, 'select', false),
    cell(rowId, 'green'),
    cell(rowId, 'red'),
  ])
}

describe('表示グリッドでのセル移動', () => {
  it.each([
    { direction: 'right' as const, row: 'top', column: 'red' },
    { direction: 'down' as const, row: 'page-3', column: 'green' },
  ])('ページ外の固定行から $direction に移動する', ({ direction, row, column }) => {
    // Arrange
    const grid = createGrid()
    const current = grid[0][1]

    // Act
    const selection = navigateCellSelection(grid, current, direction, false, [])

    // Assert
    expect(selection).toEqual([
      {
        anchorRowId: row,
        anchorColumnId: column,
        focusRowId: row,
        focusColumnId: column,
      },
    ])
  })

  it('下端の固定行から上へ移動する', () => {
    // Arrange
    const grid = createGrid()

    // Act
    const selection = navigateCellSelection(grid, grid[3][2], 'up', false, [])

    // Assert
    expect(selection).toEqual([
      {
        anchorRowId: 'page-2',
        anchorColumnId: 'red',
        focusRowId: 'page-2',
        focusColumnId: 'red',
      },
    ])
  })

  it('選択不可の列を飛ばして横移動する', () => {
    // Arrange
    const current = cell('row', 'red')
    const grid = [[cell('row', 'green'), cell('row', 'action', false), current]]

    // Act
    const selection = navigateCellSelection(grid, current, 'left', false, [])

    // Assert
    expect(selection[0]).toEqual({
      anchorRowId: 'row',
      anchorColumnId: 'green',
      focusRowId: 'row',
      focusColumnId: 'green',
    })
  })

  it('Shift では起点と既存の範囲を保ち、終点からさらに拡張する', () => {
    // Arrange
    const grid = createGrid()
    const previous: CellSelectionState = [
      { anchorRowId: 'bottom', anchorColumnId: 'red', focusRowId: 'bottom', focusColumnId: 'red' },
      { anchorRowId: 'top', anchorColumnId: 'green', focusRowId: 'page-3', focusColumnId: 'green' },
    ]

    // Act
    const selection = navigateCellSelection(grid, grid[0][1], 'down', true, previous)

    // Assert
    expect(selection).toEqual([
      previous[0],
      { anchorRowId: 'top', anchorColumnId: 'green', focusRowId: 'page-2', focusColumnId: 'green' },
    ])
    expect(previous[1].focusRowId).toBe('page-3')
  })

  it('起点が別ページの場合、現在のセルから Shift 選択を始める', () => {
    // Arrange
    const grid = createGrid()
    const previous: CellSelectionState = [
      {
        anchorRowId: 'other-page',
        anchorColumnId: 'green',
        focusRowId: 'other-page',
        focusColumnId: 'green',
      },
    ]

    // Act
    const selection = navigateCellSelection(grid, grid[0][1], 'right', true, previous)

    // Assert
    expect(selection).toEqual([
      {
        anchorRowId: 'top',
        anchorColumnId: 'green',
        focusRowId: 'top',
        focusColumnId: 'red',
      },
    ])
  })

  it('画面端では範囲を変更しない', () => {
    // Arrange
    const grid = createGrid()
    const previous: CellSelectionState = [
      {
        anchorRowId: 'top',
        anchorColumnId: 'green',
        focusRowId: 'top',
        focusColumnId: 'green',
      },
    ]

    // Act
    const selection = navigateCellSelection(grid, grid[0][1], 'up', false, previous)

    // Assert
    expect(selection).toBe(previous)
  })
})

describe('Tab の到達先', () => {
  it.each([
    { name: '未選択', focused: undefined },
    { name: '別ページに選択が残る', focused: cell('other-page', 'red') },
    { name: '非表示列に選択が残る', focused: cell('top', 'hidden') },
  ])('$name 場合は表示中の先頭の選択可能セルへ到達する', ({ focused }) => {
    // Arrange
    const grid = createGrid()

    // Act
    const tabStop = getCellTabStop(grid, focused)

    // Assert
    expect(tabStop).toBe(grid[0][1])
  })

  it('表示中の選択起点を到達先にする', () => {
    // Arrange
    const grid = createGrid()

    // Act
    const tabStop = getCellTabStop(grid, grid[2][2])

    // Assert
    expect(tabStop).toBe(grid[2][2])
  })

  it('全セルが選択不可なら到達先を作らない', () => {
    // Arrange
    const grid = [[cell('row', 'red', false)]]

    // Act
    const tabStop = getCellTabStop(grid)

    // Assert
    expect(tabStop).toBeUndefined()
  })
})
