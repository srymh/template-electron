import { afterEach, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

import { createDataTableColumnHelper, useDataTable } from './use-data-table'

type Item = { id: string; name: string; kind: string }
const data: Item[] = Array.from({ length: 60 }, (_, index) => ({
  id: `item-${index}`,
  name: `項目${index + 1}`,
  kind: `種類${index % 20}`,
}))
const getRowId = (row: Item) => row.id
const column = createDataTableColumnHelper<Item>()
const columns = column.columns([
  column.accessor('name', { header: '名前', filterFn: 'includesString' }),
  column.accessor('kind', { header: '種類', filterFn: 'includesString' }),
])
const listCapabilities = {
  pagination: true,
  sorting: true,
  columnFiltering: true,
  globalFiltering: true,
  grouping: true,
}

afterEach(cleanup)

it.each([true, false])(
  '行IDの指定=%sでも、データ差し替えでページと更新内容を保つ',
  async (hasRowId) => {
    // Arrange
    const { result, rerender } = renderHook(
      ({ rows }) =>
        useDataTable({
          data: rows,
          columns,
          capabilities: listCapabilities,
          getRowId: hasRowId ? getRowId : undefined,
          initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
        }),
      { initialProps: { rows: data } },
    )
    await act(async () => {
      result.current.getRowModel()
    })
    await act(async () => {
      result.current.setPageIndex(2)
    })
    expect(result.current.getRowModel().rows[0]!.original.name).toBe('項目11')

    // Act
    rerender({
      rows: data.map((row, index) => (index === 10 ? { ...row, name: '更新した項目11' } : row)),
    })
    await act(async () => {
      result.current.getRowModel()
    })

    // Assert
    expect(result.current.state.pagination.pageIndex).toBe(2)
    expect(result.current.getRowModel().rows[0]!.original.name).toBe('更新した項目11')
  },
)

it('初期状態で指定したページを、最初の描画では先頭へ戻さない', async () => {
  // Arrange
  const { result } = renderHook(() =>
    useDataTable({
      data,
      columns,
      capabilities: listCapabilities,
      initialState: { pagination: { pageIndex: 2, pageSize: 5 } },
    }),
  )

  // Act
  await act(async () => {
    result.current.getRowModel()
  })

  // Assert
  expect(result.current.state.pagination.pageIndex).toBe(2)
  expect(result.current.getRowModel().rows[0]!.original.name).toBe('項目11')
})

it('行が減って現在ページがなくなると最後のページに補正する', async () => {
  // Arrange
  const { result, rerender } = renderHook(
    ({ rows }) =>
      useDataTable({
        data: rows,
        columns,
        capabilities: listCapabilities,
        initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
      }),
    { initialProps: { rows: data } },
  )
  await act(async () => {
    result.current.getRowModel()
  })
  await act(async () => {
    result.current.setPageIndex(3)
  })

  // Act
  rerender({ rows: data.slice(0, 8) })
  await act(async () => {
    result.current.getRowModel()
  })

  // Assert
  expect(result.current.state.pagination.pageIndex).toBe(1)
  expect(result.current.getRowModel().rows.map((row) => row.original.id)).toEqual([
    'item-5',
    'item-6',
    'item-7',
  ])
})

it('0件への差し替えではページ番号を0へ補正する', async () => {
  // Arrange
  const { result, rerender } = renderHook(
    ({ rows }) =>
      useDataTable({
        data: rows,
        columns,
        capabilities: listCapabilities,
        initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
      }),
    { initialProps: { rows: data } },
  )
  await act(async () => {
    result.current.getRowModel()
  })
  await act(async () => {
    result.current.setPageIndex(3)
  })

  // Act
  rerender({ rows: [] })
  await act(async () => {
    result.current.getRowModel()
  })

  // Assert
  expect(result.current.state.pagination.pageIndex).toBe(0)
  expect(result.current.getRowModel().rows).toEqual([])
})

it.each(['sorting', 'columnFilters', 'globalFilter', 'grouping'] as const)(
  '%sが変わると、まだ有効なページ番号でも先頭へ戻す',
  async (condition) => {
    // Arrange
    const { result } = renderHook(() =>
      useDataTable({
        data,
        columns,
        capabilities: listCapabilities,
        initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
      }),
    )
    await act(async () => {
      result.current.getRowModel()
    })
    await act(async () => {
      result.current.setPageIndex(2)
    })

    // Act
    await act(async () => {
      if (condition === 'sorting') result.current.setSorting([{ id: 'name', desc: true }])
      if (condition === 'columnFilters')
        result.current.setColumnFilters([{ id: 'name', value: '項目' }])
      if (condition === 'globalFilter') result.current.setGlobalFilter('項目')
      if (condition === 'grouping') result.current.setGrouping(['kind'])
      result.current.getRowModel()
    })

    // Assert
    expect(result.current.getPageCount()).toBeGreaterThan(2)
    expect(result.current.state.pagination.pageIndex).toBe(0)
  },
)

it('同内容の並び替え指定は表示条件の変更として扱わない', async () => {
  // Arrange
  const { result } = renderHook(() =>
    useDataTable({
      data,
      columns,
      capabilities: listCapabilities,
      initialState: {
        pagination: { pageIndex: 0, pageSize: 5 },
        sorting: [{ id: 'name', desc: true }],
      },
    }),
  )
  await act(async () => {
    result.current.getRowModel()
  })
  await act(async () => {
    result.current.setPageIndex(2)
  })

  // Act
  await act(async () => {
    result.current.setSorting([{ id: 'name', desc: true }])
  })

  // Assert
  expect(result.current.state.pagination.pageIndex).toBe(2)
})

it.each([true, false])(
  '行IDの指定=%sに応じて、データ差し替え後の展開を保持または解除する',
  async (hasRowId) => {
    // Arrange
    const { result, rerender } = renderHook(
      ({ rows }) =>
        useDataTable({
          data: rows,
          columns,
          getRowId: hasRowId ? getRowId : undefined,
          capabilities: { grouping: true },
          initialState: { grouping: ['kind'] },
        }),
      { initialProps: { rows: data } },
    )
    await act(async () => {
      result.current.getRowModel()
    })
    await act(async () => {
      result.current.toggleAllRowsExpanded(true)
    })
    expect(result.current.getRowModel().rows).toHaveLength(80)

    // Act
    rerender({ rows: data.map((row) => ({ ...row })) })
    await act(async () => {
      result.current.getRowModel()
    })

    // Assert
    expect(result.current.atoms.expanded.get()).toEqual(hasRowId ? true : {})
    expect(result.current.getRowModel().rows).toHaveLength(hasRowId ? 80 : 20)
  },
)

it.each([true, false])(
  '行IDの指定=%sに応じて、データ差し替え後のセル選択を保持または解除する',
  async (hasRowId) => {
    // Arrange
    const { result, rerender } = renderHook(
      ({ rows }) =>
        useDataTable({
          data: rows,
          columns,
          getRowId: hasRowId ? getRowId : undefined,
          capabilities: { cellSelection: true },
        }),
      { initialProps: { rows: data } },
    )
    await act(async () => {
      result.current.getRowModel()
    })
    const rowId = result.current.getRowModel().rows[0]!.id
    await act(async () => {
      result.current.selectCellRange({
        anchorRowId: rowId,
        anchorColumnId: 'name',
        focusRowId: rowId,
        focusColumnId: 'name',
      })
    })
    expect(result.current.getSelectedCellCount()).toBe(1)

    // Act
    rerender({ rows: data.map((row) => ({ ...row })) })
    await act(async () => {
      result.current.getRowModel()
    })

    // Assert
    expect(result.current.getSelectedCellCount()).toBe(hasRowId ? 1 : 0)
    expect(result.current.getFocusedCell()?.row.id).toBe(hasRowId ? rowId : undefined)
  },
)

it('行IDがある表でも、能力を無効にした展開とセル選択は再有効化で復元しない', async () => {
  // Arrange
  const { result, rerender } = renderHook(
    ({ enabled }) =>
      useDataTable({
        data,
        columns,
        getRowId,
        capabilities: { grouping: enabled, cellSelection: enabled },
        initialState: { grouping: ['kind'] },
      }),
    { initialProps: { enabled: true } },
  )
  await act(async () => {
    result.current.getRowModel()
  })
  await act(async () => {
    result.current.toggleAllRowsExpanded(true)
    result.current.selectCellRange({
      anchorRowId: 'item-0',
      anchorColumnId: 'name',
      focusRowId: 'item-0',
      focusColumnId: 'name',
    })
  })

  // Act
  rerender({ enabled: false })
  await act(async () => {})
  rerender({ enabled: true })
  await act(async () => {})

  // Assert
  expect(result.current.atoms.expanded.get()).toEqual({})
  expect(result.current.getSelectedCellCount()).toBe(0)
})

it('metaの値だけの変更では現在ページを保つ', async () => {
  // Arrange
  const { result, rerender } = renderHook(
    ({ size }) =>
      useDataTable({
        data,
        columns,
        capabilities: listCapabilities,
        pageSizeOptions: [size],
        initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
      }),
    { initialProps: { size: 10 } },
  )
  await act(async () => {
    result.current.getRowModel()
  })
  await act(async () => {
    result.current.setPageIndex(2)
  })

  // Act
  rerender({ size: 20 })
  await act(async () => {})

  // Assert
  expect(result.current.state.pagination.pageIndex).toBe(2)
  expect(result.current.options.meta!.dataTable.pageSizeOptions).toEqual([20])
})
