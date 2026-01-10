import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { makeData } from '../data/demo-table-data'
import type { ColumnFiltersState } from '@tanstack/react-table'
import type { Person } from '../data/demo-table-data'
import { BasicTable } from '@/components/table/basic-table'
import { fuzzyFilter, fuzzySort } from '@/components/table/tableUtils'

export const Route = createFileRoute('/demo/table')({
  component: TableDemo,
  loader: () => ({ crumb: 'Table' }),
})

function TableDemo() {
  return <PersonTable />
}

function PersonTable() {
  'use no memo'

  const rerender = React.useReducer(() => ({}), {})[1]

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  )
  const [globalFilter, setGlobalFilter] = React.useState('')

  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Person>()

    return [
      columnHelper.accessor('id', {
        filterFn: 'equalsString', // 通常の非ファジーフィルタ列 - 完全一致が必要
      }),
      columnHelper.accessor('firstName', {
        cell: (info) => info.getValue(),
        filterFn: 'includesStringSensitive', // 通常の非ファジーフィルタ列 - 大文字小文字を区別
      }),
      columnHelper.accessor((row) => row.lastName, {
        id: 'lastName',
        cell: (info) => info.getValue(),
        header: () => <span>Last Name</span>,
        filterFn: 'includesString', // 通常の非ファジーフィルタ列 - 大文字小文字を区別しない
      }),
      columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
        id: 'fullName',
        header: 'Full Name',
        cell: (info) => info.getValue(),
        filterFn: 'fuzzy', // カスタムファジーフィルタ関数を使用
        // filterFn: fuzzyFilter, // 関数で直接指定も可能
        sortingFn: fuzzySort, // ファジーランクでソート（同点時は英数字順）
      }),
    ]
  }, [])

  const [data, setData] = React.useState<Array<Person>>(() => makeData(5_000))
  const refreshData = () => setData((_old) => makeData(50_000)) // ストレステスト用

  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter, // 列定義で使えるフィルタ関数として定義
    },
    state: {
      columnFilters,
      globalFilter,
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'fuzzy', // グローバルフィルタにファジーフィルタを適用（ファジーフィルタの最も一般的な使い方）
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // クライアントサイドフィルタリング
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: true,
    debugHeaders: true,
    debugColumns: false,
  })

  // fullName列がフィルタされている場合はファジーソートを適用
  React.useEffect(() => {
    if (table.getState().columnFilters[0]?.id === 'fullName') {
      if (table.getState().sorting[0]?.id !== 'fullName') {
        table.setSorting([{ id: 'fullName', desc: false }])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnFilters[0]?.id])

  return (
    <BasicTable table={table} rerender={rerender} refreshData={refreshData} />
  )
}
