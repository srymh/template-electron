import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { allCapabilities, getCapabilityTableOptions, resolveCapabilities } from './capabilities'
import type { DataTableCoreTable } from './features'
import { createAppTable } from './use-app-table'

const { createAppColumnHelper, useAppTable } = createAppTable<Record<never, never>>()

type TestRow = { name: string; value: number }

const columnHelper = createAppColumnHelper<TestRow>()
const columns = columnHelper.columns([
  columnHelper.accessor('name', {}),
  columnHelper.accessor('value', { filterFn: 'equals' }),
])
const data: TestRow[] = [
  { name: 'Alpha', value: 1 },
  { name: 'Beta', value: 2 },
]

// React adapter の実際の状態解決と、commit 相当の setOptions を検証するため、
// DOM に依存しないフックのホストだけをサーバーで描画する。
function TableHost({ onTable }: { onTable: (table: DataTableCoreTable<TestRow>) => void }) {
  onTable(
    useAppTable({
      columns,
      data,
      ...getCapabilityTableOptions(allCapabilities),
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

describe('resolveCapabilities', () => {
  it('基準を省略すると、指定した能力だけを有効にし、指定しない能力は無効にする', () => {
    // Act
    const resolved = resolveCapabilities({ sorting: true, pagination: undefined })

    // Assert
    expect(resolved.sorting).toBe(true)
    expect(resolved.pagination).toBe(false)
    expect(resolved.columnFiltering).toBe(false)
  })

  it('基準を渡すと、指定しない能力は基準の値のまま、指定した能力だけを重ねる', () => {
    // Act
    const resolved = resolveCapabilities({ pagination: false, sorting: undefined }, allCapabilities)

    // Assert
    expect(resolved.sorting).toBe(true)
    expect(resolved.pagination).toBe(false)
    expect(resolved.columnFiltering).toBe(true)
  })
})

describe('能力の切り替え', () => {
  it.each([
    {
      capability: 'sorting' as const,
      prepare: (table: DataTableCoreTable<TestRow>) =>
        table.setSorting([{ id: 'value', desc: true }]),
      before: ['Beta', 'Alpha'],
    },
    {
      capability: 'columnFiltering' as const,
      prepare: (table: DataTableCoreTable<TestRow>) =>
        table.setColumnFilters([{ id: 'value', value: 2 }]),
      before: ['Beta'],
    },
    {
      capability: 'globalFiltering' as const,
      prepare: (table: DataTableCoreTable<TestRow>) => table.setGlobalFilter('Beta'),
      before: ['Beta'],
    },
  ])('$capability を無効にすると適用済みの処理を解除する', ({ capability, prepare, before }) => {
    // Arrange
    const table = createTestTable()
    prepare(table)
    const rowsBefore = table.getRowModel().rows.map((row) => row.original.name)

    // Act
    table.setOptions((old) => ({
      ...old,
      ...getCapabilityTableOptions(resolveCapabilities({ [capability]: false }, allCapabilities)),
    }))
    const rowsDisabled = table.getRowModel().rows.map((row) => row.original.name)
    table.setOptions((old) => ({
      ...old,
      ...getCapabilityTableOptions(allCapabilities),
    }))
    const rowsReenabled = table.getRowModel().rows.map((row) => row.original.name)

    // Assert
    expect(rowsBefore).toEqual(before)
    expect(rowsDisabled).toEqual(['Alpha', 'Beta'])
    expect(rowsReenabled).toEqual(['Alpha', 'Beta'])
  })

  it('列固定を無効にすると固定領域を空にして列を中央に戻す', () => {
    // Arrange
    const table = createTestTable()
    table.setColumnPinning({ start: ['name'], end: ['value'] })

    // Act
    table.setOptions((old) => ({
      ...old,
      ...getCapabilityTableOptions(resolveCapabilities({ columnPinning: false }, allCapabilities)),
    }))
    const start = table.getStartVisibleLeafColumns().map((column) => column.id)
    const center = table.getCenterVisibleLeafColumns().map((column) => column.id)
    const end = table.getEndVisibleLeafColumns().map((column) => column.id)

    // Assert
    expect(start).toEqual([])
    expect(center).toEqual(['name', 'value'])
    expect(end).toEqual([])
  })

  it('列フィルターの無効化で、有効なソート状態を変更しない', () => {
    // Arrange
    const table = createTestTable()
    table.setSorting([{ id: 'value', desc: true }])
    table.setColumnFilters([{ id: 'value', value: 2 }])

    // Act
    table.setOptions((old) => ({
      ...old,
      ...getCapabilityTableOptions(
        resolveCapabilities({ columnFiltering: false }, allCapabilities),
      ),
    }))
    const names = table.getRowModel().rows.map((row) => row.original.name)

    // Assert
    expect(names).toEqual(['Beta', 'Alpha'])
  })

  it('グループ化とページ分割を無効にすると元の全行を表示する', () => {
    // Arrange
    const table = createTestTable()
    table.setGrouping(['name'])
    table.setExpanded(true)
    table.setPagination({ pageIndex: 1, pageSize: 1 })

    // Act
    table.setOptions((old) => ({
      ...old,
      ...getCapabilityTableOptions(
        resolveCapabilities({ grouping: false, pagination: false }, allCapabilities),
      ),
    }))
    const names = table.getRowModel().rows.map((row) => row.original.name)
    const grouped = table.getRowModel().rows.some((row) => row.getIsGrouped())
    const expanded = table.atoms.expanded.get()

    // Assert
    expect(names).toEqual(['Alpha', 'Beta'])
    expect(grouped).toBe(false)
    expect(expanded).toEqual({})
  })

  it('行固定・選択・列の表示設定を無効にすると表示に残さない', () => {
    // Arrange
    const table = createTestTable()
    table.setRowPinning({ top: ['0'], bottom: [] })
    table.setRowSelection({ '0': true })
    table.setFocusedCell('0', 'name')
    table.setColumnVisibility({ name: false })
    table.setColumnOrder(['value', 'name'])
    table.setColumnSizing({ name: 250 })

    // Act
    table.setOptions((old) => ({
      ...old,
      ...getCapabilityTableOptions(
        resolveCapabilities(
          {
            rowPinning: false,
            rowSelection: false,
            cellSelection: false,
            columnVisibility: false,
            columnOrdering: false,
            columnResizing: false,
          },
          allCapabilities,
        ),
      ),
    }))
    const top = table.getTopRows()
    const selected = table.getRow('0').getIsSelected()
    const focused = table.getFocusedCell()
    const visibleColumns = table.getVisibleLeafColumns().map((column) => column.id)
    const nameSize = table.getColumn('name')?.getSize()

    // Assert
    expect(top).toEqual([])
    expect(selected).toBe(false)
    expect(focused).toBeUndefined()
    expect(visibleColumns).toEqual(['name', 'value'])
    expect(nameSize).toBe(150)
  })
})
