import { flexRender } from '@tanstack/react-table'
import type { Column, Table } from '@tanstack/react-table'

import { cn } from '@repo/ui/lib/utils'

export function TableBody<T>(props: {
  table: Table<T>
  getCommonPinningStyles: (column: Column<T>) => React.CSSProperties
}) {
  'use no memo'

  const { table, getCommonPinningStyles } = props

  const isResizingId = table.getState().columnSizingInfo.isResizingColumn

  return (
    <tbody className="bg-background text-foreground">
      {table.getTopRows().map((row) => {
        return (
          <tr
            key={row.id}
            className={cn('transition-colors group h-12 [&:last-child_td]:border-b-0', {
              sticky: row.getIsPinned() === 'top',
              'z-15': row.getIsPinned() === 'top',
            })}
            style={{
              top:
                row.getIsPinned() === 'top' ? `${row.getPinnedIndex() * 48 + 48 + 1}px` : undefined,
            }}
          >
            {row.getVisibleCells().map((cell) => {
              return (
                <td
                  key={cell.id}
                  className="px-4 py-3 truncate bg-background group-[&:hover]:bg-accent relative border-b border-b-border"
                  style={{ ...getCommonPinningStyles(cell.column) }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  <div
                    className={cn(
                      'absolute top-0 right-0 h-full w-1 transition-colors select-none pointer-events-none',
                      {
                        'bg-gray-500': isResizingId === cell.column.id,
                      },
                    )}
                  />
                </td>
              )
            })}
          </tr>
        )
      })}
      {table.getCenterRows().map((row) => {
        return (
          <tr key={row.id} className="transition-colors group h-12 [&:last-child_td]:border-b-0">
            {row.getVisibleCells().map((cell) => {
              return (
                <td
                  key={cell.id}
                  className="px-4 py-3 truncate bg-background group-[&:hover]:bg-accent relative border-b border-b-border"
                  style={{ ...getCommonPinningStyles(cell.column) }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  <div
                    className={cn(
                      'absolute top-0 right-0 h-full w-1 transition-colors select-none pointer-events-none',
                      {
                        'bg-gray-500': isResizingId === cell.column.id,
                      },
                    )}
                  />
                </td>
              )
            })}
          </tr>
        )
      })}
    </tbody>
  )
}
