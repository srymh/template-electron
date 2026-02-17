import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Square, Table } from 'lucide-react'
import type { Table as TanStackTable } from '@tanstack/react-table'
import { BasicTable } from '@/components/table/basic-table'
import { fuzzyFilter } from '@/components/table/tableUtils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { kakeibo } from '@/api'

export type Entry = Awaited<ReturnType<typeof kakeibo.entries>>[number]

export const Route = createFileRoute('/(app)/demo/kakeibo')({
  component: RouteComponent,
  loader: () => ({ crumb: '家計簿' }),
})

function RouteComponent() {
  const { data, refetch } = useQuery({
    queryKey: ['kakeibo', 'entries'],
    queryFn: async (): Promise<Array<Entry>> => {
      const result = await kakeibo.entries()
      return result
    },
  })

  console.log(data)

  if (!data) {
    return <div>Loading...</div>
  }

  return <View data={data} refreshData={refetch} />
}

function View(props: { data: Array<Entry>; refreshData?: () => void }) {
  'use no memo'

  const { data, refreshData } = props

  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Entry>()

    return [
      columnHelper.accessor('id', {
        size: 80,
        filterFn: 'equalsString',
        meta: {
          filterVariant: 'text',
        },
      }),
      columnHelper.accessor('amount', {
        cell: (info) => info.getValue(),
        header: '金額',
        filterFn: 'inNumberRange',
        size: 120,
        meta: {
          filterVariant: 'range', // 範囲フィルタを使用
        },
      }),
      columnHelper.accessor('spent_at', {
        cell: (info) => info.getValue(),
        header: '支出日',
        size: 100,
        meta: {
          filterVariant: 'text',
        },
      }),
      columnHelper.accessor('user', {
        cell: (info) => info.getValue(),
        header: 'ユーザー',
        size: 120,
        meta: {
          filterVariant: 'select',
        },
      }),
      columnHelper.accessor('payment_method', {
        cell: (info) => info.getValue(),
        header: '支払い方法',
        size: 200,
        meta: {
          filterVariant: 'select',
        },
      }),
      columnHelper.accessor('category', {
        cell: (info) => info.getValue(),
        header: 'カテゴリ',
        size: 200,
        meta: {
          filterVariant: 'text',
        },
      }),
    ]
  }, [])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter, // 列定義で使えるフィルタ関数として定義
    },
    globalFilterFn: 'fuzzy', // グローバルフィルタにファジーフィルタを適用（ファジーフィルタの最も一般的な使い方）
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // クライアントサイドフィルタリング
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    debugTable: true,
    debugHeaders: true,
    debugColumns: false,
    columnResizeMode: 'onChange',
  })

  return (
    <Tabs defaultValue="card" className="w-full h-full p-2">
      <TabsList>
        <TabsTrigger value="card">
          <Square />
          カード
        </TabsTrigger>
        <TabsTrigger value="table">
          <Table />
          テーブル
        </TabsTrigger>
      </TabsList>
      <TabsContent value="card">
        <CardView table={table} />
      </TabsContent>
      <TabsContent value="table" className="rounded-lg overflow-auto">
        <TableView table={table} refreshData={refreshData} />
      </TabsContent>
    </Tabs>
  )
}

function TableView(props: {
  table: TanStackTable<Entry>
  refreshData?: () => void
}) {
  'use no memo'

  const { table, refreshData } = props
  return <BasicTable table={table} refreshData={refreshData} />
}

function CardView(props: { table: TanStackTable<Entry> }) {
  'use no memo'

  const { table } = props
  return (
    <div className="grid grid-cols-1 gap-4">
      {table.getRowModel().rows.map((row) => (
        <Card key={row.id} entry={row.original} />
      ))}
    </div>
  )
}

function Card(props: { entry: Entry }) {
  const { entry } = props

  return (
    <div className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-600 text-sm">{entry.spent_at}</span>
        <span className="text-lg font-bold text-green-700">
          ¥{entry.amount.toLocaleString()}
        </span>
      </div>
      <div className="text-gray-700 text-sm">
        <span className="mr-4">
          ユーザー: <span className="font-medium">{entry.user}</span>
        </span>
        <span className="mr-4">
          カテゴリ: <span className="font-medium">{entry.category}</span>
        </span>
        <span>
          支払い方法:{' '}
          <span className="font-medium">{entry.payment_method}</span>
        </span>
      </div>
    </div>
  )
}
