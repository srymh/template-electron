import React from 'react'
import type { Column } from '@tanstack/react-table'
import { DebouncedInput } from '@/components/table/debounced-input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

export function Filter({ column }: { column: Column<any, unknown> }) {
  'use no memo'

  const { filterVariant } = column.columnDef.meta ?? {}

  const columnFilterValue = column.getFilterValue() as
    | [number, number]
    | string
    | null

  const sortedUniqueValues = React.useMemo(
    () =>
      filterVariant === 'range'
        ? []
        : Array.from(column.getFacetedUniqueValues().keys())
            .sort()
            .slice(0, 5000),
    [column, filterVariant],
  )

  return filterVariant === 'range' ? (
    <div>
      <div className="flex space-x-2">
        <DebouncedInput
          type="number"
          min={Number(column.getFacetedMinMaxValues()?.[0] ?? '')}
          max={Number(column.getFacetedMinMaxValues()?.[1] ?? '')}
          value={columnFilterValue?.[0] ?? ''}
          onChange={(value) =>
            column.setFilterValue((old: [number, number]) => [value, old[1]])
          }
          placeholder={`Min ${
            column.getFacetedMinMaxValues()?.[0] !== undefined
              ? `(${column.getFacetedMinMaxValues()?.[0]})`
              : ''
          }`}
        />
        <DebouncedInput
          type="number"
          min={Number(column.getFacetedMinMaxValues()?.[0] ?? '')}
          max={Number(column.getFacetedMinMaxValues()?.[1] ?? '')}
          value={columnFilterValue?.[1] ?? ''}
          onChange={(value) =>
            column.setFilterValue((old: [number, number]) => [old[0], value])
          }
          placeholder={`Max ${
            column.getFacetedMinMaxValues()?.[1]
              ? `(${column.getFacetedMinMaxValues()?.[1]})`
              : ''
          }`}
        />
      </div>
      <div className="h-1" />
    </div>
  ) : filterVariant === 'select' ? (
    <NativeSelect
      onChange={(e) => column.setFilterValue(e.target.value)}
      // setFilterValueでフィルターをクリアしたときに正しくvalueを更新するために
      // columnFilterValueがnullかundefinedの場合は明示的に空文字を設定する。
      value={columnFilterValue == null ? '' : columnFilterValue.toString()}
      className="w-full"
    >
      <NativeSelectOption value="">All</NativeSelectOption>
      {sortedUniqueValues.map((value) => (
        // dynamically generated select options from faceted values feature
        <NativeSelectOption value={value} key={value}>
          {value}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  ) : filterVariant === 'text' ? (
    <>
      {/* Autocomplete suggestions from faceted values feature */}
      <datalist id={column.id + 'list'}>
        {sortedUniqueValues.map((value: any) => (
          <option value={value} key={value} />
        ))}
      </datalist>
      <DebouncedInput
        type="text"
        value={(columnFilterValue ?? '') as string}
        onChange={(value) => column.setFilterValue(value)}
        placeholder={`検索... (${column.getFacetedUniqueValues().size})`}
        list={column.id + 'list'}
      />
      <div className="h-1" />
    </>
  ) : (
    <DebouncedInput
      type="text"
      value={(columnFilterValue ?? '') as string}
      onChange={(value) => column.setFilterValue(value)}
      placeholder={`検索...`}
    />
  )
}
