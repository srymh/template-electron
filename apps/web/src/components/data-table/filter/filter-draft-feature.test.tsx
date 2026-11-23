import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { selectBodyState } from '../features'
import type { DataTableCoreTable } from '../features'
import { createAppTable } from '../use-app-table'

const { createAppColumnHelper, useAppTable } = createAppTable<Record<never, never>>()

type TestRow = { name: string; kind: string }

const columnHelper = createAppColumnHelper<TestRow>()
const columns = columnHelper.columns([
  columnHelper.accessor('name', { filterFn: 'includesString' }),
  columnHelper.accessor('kind', { filterFn: 'equalsString' }),
])
const data: TestRow[] = [
  { name: 'Alpha', kind: 'a' },
  { name: 'Beta', kind: 'b' },
]

// 構築したテーブルの API と状態を検証するため、DOM に依存しないフックのホストだけをサーバーで描画する。
function TableHost({ onTable }: { onTable: (table: DataTableCoreTable<TestRow>) => void }) {
  onTable(
    useAppTable({
      columns,
      data,
      initialState: { columnFilters: [{ id: 'kind', value: 'a' }], globalFilter: 'Al' },
    }),
  )
  return null
}

function createTestTable() {
  let table: DataTableCoreTable<TestRow> | undefined
  renderToStaticMarkup(<TableHost onTable={(created) => (table = created)} />)
  if (!table) throw new Error('テーブルが作成されていない')
  return table
}

describe('filterDraftFeature', () => {
  it('宣言した下書きと解除の操作を、構築したテーブルと列に持つ', () => {
    // Act
    const table = createTestTable()
    const column = table.getColumn('name')!

    // Assert
    expect(typeof table.clearFilters).toBe('function')
    expect(typeof table.clearColumnFilters).toBe('function')
    expect(typeof table.clearGlobalFilter).toBe('function')
    expect(typeof table.setGlobalFilterDraft).toBe('function')
    expect(typeof table.commitGlobalFilterDraft).toBe('function')
    expect(typeof column.clearFilter).toBe('function')
    expect(typeof column.setFilterDraft).toBe('function')
    expect(typeof column.commitFilterDraft).toBe('function')
  })

  it('下書きは入力欄の値として読め、確定するまで確定値を変えない', () => {
    // Arrange
    const table = createTestTable()
    const column = table.getColumn('name')!

    // Act
    column.setFilterDraft('Be')
    table.setGlobalFilterDraft('B')
    const beforeCommit = {
      columnInput: column.getFilterInputValue(),
      columnValue: column.getFilterValue(),
      globalInput: table.getGlobalFilterInputValue(),
      globalValue: table.atoms.globalFilter.get(),
    }
    column.commitFilterDraft()
    table.commitGlobalFilterDraft()

    // Assert
    expect(beforeCommit).toEqual({
      columnInput: 'Be',
      columnValue: undefined,
      globalInput: 'B',
      globalValue: 'Al',
    })
    expect(column.getFilterValue()).toBe('Be')
    expect(table.atoms.globalFilter.get()).toBe('B')
    expect(table.atoms.filterDrafts.get()).toEqual({ columns: {} })
  })

  it('下書きの更新関数は入力欄の値に重ね、確定時に確定値を作る関数を通す', () => {
    // Arrange
    const table = createTestTable()
    const column = table.getColumn('name')!

    // Act
    column.setFilterDraft('A')
    column.setFilterDraft((old: unknown) => `${String(old)}l`)
    column.commitFilterDraft((draft) => `${String(draft)}!`)

    // Assert
    expect(column.getFilterValue()).toBe('Al!')
  })

  it('書き始めた後に確定値が外から変わった下書きは、表示せず確定もしない', () => {
    // Arrange
    const table = createTestTable()
    const column = table.getColumn('kind')!
    column.setFilterDraft('x')

    // Act
    column.setFilterValue('b')
    const inputValue = column.getFilterInputValue()
    column.commitFilterDraft()

    // Assert
    expect(inputValue).toBe('b')
    expect(column.getFilterValue()).toBe('b')
    expect(table.atoms.filterDrafts.get()).toEqual({ columns: {} })
  })

  it('clearFilters は下書きをすべて捨て、一覧検索と列フィルターを既定値に戻す', () => {
    // Arrange
    const table = createTestTable()
    table.getColumn('name')!.setFilterDraft('Be')
    table.setGlobalFilterDraft('B')

    // Act
    table.clearFilters()
    table.getColumn('name')!.commitFilterDraft()
    table.commitGlobalFilterDraft()

    // Assert
    expect(table.atoms.columnFilters.get()).toEqual([])
    expect(table.atoms.globalFilter.get()).toBeUndefined()
  })

  it('clearColumnFilters と clearGlobalFilter は、一方の値だけを戻し、両方の下書きを捨てる', () => {
    // Arrange
    const columnTable = createTestTable()
    const globalTable = createTestTable()
    for (const table of [columnTable, globalTable]) {
      table.getColumn('name')!.setFilterDraft('Be')
      table.setGlobalFilterDraft('B')
    }

    // Act
    columnTable.clearColumnFilters()
    globalTable.clearGlobalFilter()

    // Assert
    expect(columnTable.atoms.columnFilters.get()).toEqual([])
    expect(columnTable.atoms.globalFilter.get()).toBe('Al')
    expect(columnTable.atoms.filterDrafts.get()).toEqual({ columns: {} })
    expect(globalTable.atoms.columnFilters.get()).toEqual([{ id: 'kind', value: 'a' }])
    expect(globalTable.atoms.globalFilter.get()).toBeUndefined()
    expect(globalTable.atoms.filterDrafts.get()).toEqual({ columns: {} })
  })

  it('列の clearFilter は、その列の値を undefined にし、その列の下書きだけを捨てる', () => {
    // Arrange
    const table = createTestTable()
    table.getColumn('kind')!.setFilterDraft('b')
    table.getColumn('name')!.setFilterDraft('Be')
    table.setGlobalFilterDraft('B')

    // Act
    table.getColumn('kind')!.clearFilter()

    // Assert
    expect(table.atoms.columnFilters.get()).toEqual([])
    expect(table.getColumn('kind')!.getFilterInputValue()).toBeUndefined()
    expect(table.getColumn('name')!.getFilterInputValue()).toBe('Be')
    expect(table.getGlobalFilterInputValue()).toBe('B')
  })

  it('table.reset() は下書きも初期値に戻し、待機後の確定は何もしない', () => {
    // Arrange
    const table = createTestTable()
    table.getColumn('name')!.setFilterDraft('Be')
    table.setGlobalFilterDraft('B')

    // Act
    table.reset()
    table.getColumn('name')!.commitFilterDraft()
    table.commitGlobalFilterDraft()

    // Assert
    expect(table.atoms.filterDrafts.get()).toEqual({ columns: {} })
    expect(table.getColumn('name')!.getFilterValue()).toBeUndefined()
    expect(table.atoms.globalFilter.get()).toBe('Al')
  })

  it('下書きはテーブル本体の購読に含めない', () => {
    // Arrange
    const table = createTestTable()

    // Act
    const selected = selectBodyState(table.store.state)

    // Assert
    expect(selected).not.toHaveProperty('filterDrafts')
  })
})
