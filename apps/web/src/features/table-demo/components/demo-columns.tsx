import { createDataTableColumnHelper } from '@/components/data-table'

import type { DemoRow } from '../data/demo-rows'

const column = createDataTableColumnHelper<DemoRow>()

/**
 * NULL を値と区別できるように示すセルの表示。
 */
function NullableValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">NULL</span>
  }
  return <>{String(value)}</>
}

/**
 * 検証用の表の列。全6種類の列フィルターを1列ずつ持ち、長文・複数行の列を含む。
 *
 * @remarks
 * 行選択・行の固定の列は共通テーブルが能力に応じて加えるため、ここには含めない。
 */
export const demoColumns = [
  column.accessor('id', { header: 'ID', size: 90 }),
  column.accessor('name', {
    header: '名前',
    filterFn: 'includesString',
    meta: { filterVariant: 'text' },
  }),
  column.accessor('kind', {
    header: '種類',
    filterFn: 'equalsString',
    meta: { filterVariant: 'select' },
    cell: ({ getValue }) => <NullableValue value={getValue()} />,
  }),
  column.accessor('level', {
    header: 'レベル',
    size: 120,
    filterFn: 'inNumberRange',
    meta: { filterVariant: 'number-range' },
    cell: ({ getValue }) => <NullableValue value={getValue()} />,
  }),
  column.accessor('rank', {
    header: 'ランク',
    size: 100,
    filterFn: 'equals',
    meta: { filterVariant: 'number-equals' },
  }),
  column.accessor('active', {
    header: '有効',
    size: 100,
    filterFn: 'equals',
    meta: { filterVariant: 'boolean' },
    cell: ({ getValue }) => String(getValue()),
  }),
  column.accessor('date', {
    header: '日付',
    size: 220,
    filterFn: 'dateRange',
    meta: { filterVariant: 'date-range' },
  }),
  column.accessor('note', {
    header: '本文',
    size: 240,
    cell: ({ getValue }) => <div className="whitespace-pre-wrap">{getValue()}</div>,
  }),
  column.accessor('optional', {
    header: '任意',
    cell: ({ getValue }) => <NullableValue value={getValue()} />,
  }),
]
