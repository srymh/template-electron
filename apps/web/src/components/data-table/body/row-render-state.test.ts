import { describe, expect, it } from 'vitest'
import type { CellSelectionState } from '@tanstack/react-table'
import { act, renderHook } from '@testing-library/react'

import { noCapabilities } from '../capabilities'
import { getDisplayRows } from '../display-order'
import { getTableMeta } from '../features'
import type { DataTableCoreTable } from '../features'
import { createDataTableColumnHelper, useDataTable } from '../use-data-table'
import { getRowChangeKey, getRowRenderState } from './row-render-state'

type Item = { id: string; name: string; kind: string; level: number }

const column = createDataTableColumnHelper<Item>()
const columns = [
  column.accessor('name', { header: '名前' }),
  column.accessor('kind', { header: '種類' }),
  column.accessor('level', { header: 'レベル' }),
]
const items: Item[] = ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({
  id,
  name: `名前-${id}`,
  kind: `種類-${id}`,
  level: index,
}))

// セル選択だけを持つ表。ページ分割がないため全行を描画する
function createTable(): DataTableCoreTable {
  const { result } = renderHook(() =>
    useDataTable({
      columns,
      data: items,
      getRowId: (item) => item.id,
      capabilities: { ...noCapabilities, cellSelection: true },
    }),
  )
  // 行の表示状態の計算は、登録した部品と同じく行データの型を緩めたテーブルで受け取る（DataTableView と同じ境界）
  return result.current as unknown as DataTableCoreTable
}

/**
 * セル選択の能力と表示設定を後から変えられる表を作る。能力や表示設定を変えるとテーブルが作り直されるため、
 * 変えた後は `getTable` で最新のテーブルを読む。
 */
function createSwitchableTable() {
  const { result, rerender } = renderHook(
    ({ cellSelection }: { cellSelection: boolean }) =>
      useDataTable({
        columns,
        data: items,
        getRowId: (item) => item.id,
        capabilities: { ...noCapabilities, cellSelection },
      }),
    { initialProps: { cellSelection: true } },
  )
  return {
    getTable: () => result.current as unknown as DataTableCoreTable,
    setCellSelection: (cellSelection: boolean) => rerender({ cellSelection }),
    setTableFixed: (tableFixed: boolean) =>
      getTableMeta(result.current as unknown as DataTableCoreTable).onChangeLayout({ tableFixed }),
  }
}

/**
 * 表示順の全行について、変更キーと、描画に使う表示状態を比べられる文字列を読む。
 * セルのオブジェクトは状態が変わっても同じ参照なので、セルの ID に置き換える。
 */
function readRows(table: DataTableCoreTable) {
  return getDisplayRows(table).map((row) => {
    const { cells, ...rowState } = getRowRenderState(row, table)
    const cellStates = cells.map(({ cell, ...cellState }) => ({ id: cell.id, ...cellState }))
    return {
      id: row.id,
      key: getRowChangeKey(row, table),
      cells: cellStates,
      state: JSON.stringify({
        ...rowState,
        cells: cellStates,
      }),
    }
  })
}

type RowReading = ReturnType<typeof readRows>[number]

/** `table.Subscribe` と同じく、キーの要素ごとの `===` で等しいかを判定する。 */
function isSameKey(before: RowReading['key'], after: RowReading['key']) {
  return before.length === after.length && before.every((value, index) => value === after[index])
}

/** 表示状態が変わった行の ID と、そのうち変更キーが変わらなかった（描画し直されない）行の ID。 */
function compareRows(before: RowReading[], after: RowReading[]) {
  const changedRowIds = after
    .filter((row, index) => row.state !== before[index]!.state)
    .map((row) => row.id)
  const missedRowIds = after
    .filter(
      (row, index) => changedRowIds.includes(row.id) && isSameKey(before[index]!.key, row.key),
    )
    .map((row) => row.id)
  return { changedRowIds, missedRowIds }
}

/**
 * 1つの長方形の選択範囲。最後の範囲の起点（anchor）がフォーカスのセルになる。
 * `exclude` を渡すと、それまでの範囲からこの長方形を除く。
 */
function range(
  anchor: [rowId: string, columnId: string],
  focus: [rowId: string, columnId: string],
  operation?: 'exclude',
): CellSelectionState[number] {
  return {
    anchorRowId: anchor[0],
    anchorColumnId: anchor[1],
    focusRowId: focus[0],
    focusColumnId: focus[1],
    ...(operation && { operation }),
  }
}

describe('getRowChangeKey', () => {
  it('隣の行の選択が変わって上下の境界線が変わる行は、変更キーも変わる', () => {
    // Arrange
    const table = createTable()
    // b・c 行の全列を選び、c 行の種類だけを除く。選択は b 行の長方形と、c 行の名前・レベルの長方形に分かれ、
    // b 行の種類のセルだけが下側に境界線を持つ
    const bothRows = range(['b', 'name'], ['c', 'level'])
    act(() => table.setCellSelection([bothRows, range(['c', 'kind'], ['c', 'kind'], 'exclude')]))
    const before = readRows(table)

    // Act
    // 除く列をレベルへ移す。b 行の長方形は変わらず、隣の c 行の長方形だけが変わるため、
    // b 行では種類の下側の境界線が消え、レベルの下側に付く
    act(() => table.setCellSelection([bothRows, range(['c', 'level'], ['c', 'level'], 'exclude')]))
    const after = readRows(table)
    const { changedRowIds, missedRowIds } = compareRows(before, after)
    const bottomEdgesBefore = before
      .find((row) => row.id === 'b')!
      .cells.map((cell) => ({
        id: cell.id,
        bottom: cell.edges.bottom,
      }))
    const bottomEdgesAfter = after
      .find((row) => row.id === 'b')!
      .cells.map((cell) => ({
        id: cell.id,
        bottom: cell.edges.bottom,
      }))

    // Assert
    expect(bottomEdgesBefore).toEqual([
      { id: 'b_name', bottom: false },
      { id: 'b_kind', bottom: true },
      { id: 'b_level', bottom: false },
    ])
    expect(bottomEdgesAfter).toEqual([
      { id: 'b_name', bottom: false },
      { id: 'b_kind', bottom: false },
      { id: 'b_level', bottom: true },
    ])
    expect(changedRowIds).toEqual(['b', 'c'])
    expect(missedRowIds).toEqual([])
  })

  it('選択範囲を保ったままフォーカスの列が変わる行は、変更キーも変わる', () => {
    // Arrange
    const table = createTable()
    // b 行の名前から種類までを選び、起点（フォーカス）を名前に置く
    act(() => table.setCellSelection([range(['b', 'name'], ['b', 'kind'])]))
    const before = readRows(table)

    // Act
    // 同じ範囲のまま、起点を種類へ移す
    act(() => table.setCellSelection([range(['b', 'kind'], ['b', 'name'])]))
    const after = readRows(table)
    const { changedRowIds, missedRowIds } = compareRows(before, after)
    const cellsBefore = before.flatMap((row) => row.cells)
    const cellsAfter = after.flatMap((row) => row.cells)
    const selectedIdsBefore = cellsBefore
      .filter((cell) => cell.isCellSelected)
      .map((cell) => cell.id)
    const selectedIdsAfter = cellsAfter.filter((cell) => cell.isCellSelected).map((cell) => cell.id)
    const focusedIdsBefore = cellsBefore.filter((cell) => cell.isFocused).map((cell) => cell.id)
    const focusedIdsAfter = cellsAfter.filter((cell) => cell.isFocused).map((cell) => cell.id)

    // Assert
    expect(selectedIdsBefore).toEqual(['b_name', 'b_kind'])
    expect(selectedIdsAfter).toEqual(['b_name', 'b_kind'])
    expect(focusedIdsBefore).toEqual(['b_name'])
    expect(focusedIdsAfter).toEqual(['b_kind'])
    expect(changedRowIds).toEqual(['b'])
    expect(missedRowIds).toEqual([])
  })

  it('選択のない表で離れた行に起点を置くと、Tab の到達先から外れた先頭行の変更キーも変わる', () => {
    // Arrange
    // 選択がない間は、表示順で最初のセル（a 行の名前）が Tab の到達先になる
    const table = createTable()
    const before = readRows(table)

    // Act
    // 先頭行から上下1行より離れた e 行のレベルに起点を置く。a 行は選択範囲にもフォーカスにも関わらず、
    // Tab の到達先から外れることだけで表示状態が変わる
    act(() => table.setCellSelection([range(['e', 'level'], ['e', 'level'])]))
    const after = readRows(table)
    const { changedRowIds, missedRowIds } = compareRows(before, after)
    const tabStopIdsBefore = before
      .flatMap((row) => row.cells)
      .filter((cell) => cell.isTabStop)
      .map((cell) => cell.id)
    const tabStopIdsAfter = after
      .flatMap((row) => row.cells)
      .filter((cell) => cell.isTabStop)
      .map((cell) => cell.id)

    // Assert
    expect(tabStopIdsBefore).toEqual(['a_name'])
    expect(tabStopIdsAfter).toEqual(['e_level'])
    expect(changedRowIds).toEqual(['a', 'e'])
    expect(missedRowIds).toEqual([])
  })

  it('セル選択の能力を無効にしてから有効に戻すと、Tab の到達先を持つ先頭行の変更キーも変わる', () => {
    // Arrange
    // b・c 行を選んでから能力を無効にし、選択を捨てる。無効の間は Tab の到達先を求めない
    const { getTable, setCellSelection } = createSwitchableTable()
    act(() => getTable().setCellSelection([range(['b', 'kind'], ['c', 'level'])]))
    act(() => setCellSelection(false))
    const before = readRows(getTable())

    // Act
    act(() => setCellSelection(true))
    const after = readRows(getTable())
    const { changedRowIds, missedRowIds } = compareRows(before, after)
    const tabStopIdsBefore = before
      .flatMap((row) => row.cells)
      .filter((cell) => cell.isTabStop)
      .map((cell) => cell.id)
    const tabStopIdsAfter = after
      .flatMap((row) => row.cells)
      .filter((cell) => cell.isTabStop)
      .map((cell) => cell.id)

    // Assert
    expect(tabStopIdsBefore).toEqual([])
    expect(tabStopIdsAfter).toEqual(['a_name'])
    expect(changedRowIds).toEqual(['a'])
    expect(missedRowIds).toEqual([])
  })

  it('列幅を固定しない表に切り替えると、本文のセルが最小幅を持つ全行の変更キーも変わる', () => {
    // Arrange
    // 列幅を固定する表（既定）の本文のセルは、列幅を持たない
    const { getTable, setTableFixed } = createSwitchableTable()
    const before = readRows(getTable())

    // Act
    act(() => setTableFixed(false))
    const after = readRows(getTable())
    const { changedRowIds, missedRowIds } = compareRows(before, after)
    const minSizesBefore = before[0]!.cells.map((cell) => [cell.id, cell.minSize])
    const minSizesAfter = after[0]!.cells.map((cell) => [cell.id, cell.minSize])

    // Assert
    expect(minSizesBefore).toEqual([
      ['a_name', undefined],
      ['a_kind', undefined],
      ['a_level', undefined],
    ])
    expect(minSizesAfter).toEqual([
      ['a_name', 150],
      ['a_kind', 150],
      ['a_level', 150],
    ])
    expect(changedRowIds).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(missedRowIds).toEqual([])
  })
})
