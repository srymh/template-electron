import React from 'react'

import type { Table } from '@tanstack/react-table'
import { ListFilter } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'

import { TableBody } from './body/body'
import { GlobalColumnVisibilityToggle } from './controls/global-column-visibility-toggle'
import { GlobalFilter } from './controls/global-filter'
import { GlobalTableControls } from './controls/global-table-controls'
import { Pagination } from './controls/pagination'
import { DebugInfo } from './debug'
import { getCommonPinningStyles } from './get-common-pinning-styles'
import { TableHeader } from './header/header'
import { usePinColumn } from './use-pin-column'

export function BasicTable<T>(props: {
  table: Table<T>
  rerender?: () => void
  refreshData?: () => void
  debug?: boolean
}) {
  'use no memo'

  const { table, rerender, refreshData, debug = false } = props

  const { pinColumn, id: pinColumnId } = usePinColumn<T>()

  // レンダー中に実行して、列がモデル計算に参加するようにする必要があります。
  // 重要: prev.columnsを変更しないでください。
  table.setOptions((prev) => {
    const columns = prev.columns

    const firstId = (columns[0] as any)?.id
    const hasPin = firstId === pinColumnId || columns.some((col: any) => col?.id === pinColumnId)
    const needsResizeMode = prev.columnResizeMode !== 'onChange'

    // 変更がない場合は高速パス - ページネーションの自動リセットを回避します。
    if (hasPin && firstId === pinColumnId && !needsResizeMode) {
      return prev
    }

    // ピン留め列を先頭に追加し、既存のピン留め列を削除します。
    const nextColumns =
      hasPin && firstId === pinColumnId
        ? columns
        : [pinColumn, ...columns.filter((col: any) => col?.id !== pinColumnId)]

    return {
      ...prev,
      columns: nextColumns,
      columnResizeMode: 'onChange',
    }
  })

  const globalFilter = table.getState().globalFilter ?? ''
  const handleChangeGlobalFilter = table.setGlobalFilter

  /**
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   */
  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders()
    const colSizes: { [key: string]: number } = {}
    for (const header of headers) {
      colSizes[`--header-${header.id}-size`] = header.getSize()
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize()
    }
    return colSizes
  }, [table.getState().columnSizingInfo, table.getState().columnSizing])

  const [showFilters, setShowFilters] = React.useState(false)
  const [isTableWidthFull, setIsTableWidthFull] = React.useState(true)
  const [isTableHeightFixed, setIsTableHeightFixed] = React.useState(false)

  return (
    <div className="min-h-full bg-background p-6 overflow-auto">
      <div className="flex flex-row flex-nowrap gap-2">
        <div className="bg-background text-foreground rounded-xl flex-1">
          <GlobalFilter
            globalFilter={globalFilter}
            onChangeGlobalFilter={handleChangeGlobalFilter}
          />
        </div>
        <Button variant="outline" size="default" onClick={() => setShowFilters(!showFilters)}>
          <ListFilter />
          <span className="ml-2">{showFilters ? 'フィルターを非表示' : 'フィルターを表示'}</span>
        </Button>
        <GlobalColumnVisibilityToggle table={table} />
        <GlobalTableControls
          table={table}
          isTableWidthFull={isTableWidthFull}
          setIsTableWidthFull={setIsTableWidthFull}
          isTableHeightFixed={isTableHeightFixed}
          setIsTableHeightFixed={setIsTableHeightFixed}
        />
      </div>
      <div className="h-4" />
      <div
        style={
          {
            ...columnSizeVars, // Define column sizes on the <table> element
            '--table-total-width': table.getTotalSize() + 'px',
            '--table-height': '80vh',
          } as React.CSSProperties
        }
        className={cn('w-full rounded-lg border border-border overflow-auto overscroll-none', {
          'h-(--table-height)': isTableHeightFixed,
        })}
      >
        <table
          className={cn('text-sm text-foreground table-fixed border-spacing-0 border-separate', {
            'min-w-full': isTableWidthFull,
            'w-full': isTableWidthFull,
            'w-(--table-total-width)': !isTableWidthFull,
          })}
        >
          <TableHeader
            table={table}
            showFilters={showFilters}
            getCommonPinningStyles={getCommonPinningStyles}
          />
          <TableBody table={table} getCommonPinningStyles={getCommonPinningStyles} />
        </table>
      </div>
      <div className="h-4" />
      <Pagination table={table} />
      {debug && <DebugInfo table={table} rerender={rerender} refreshData={refreshData} />}
    </div>
  )
}
