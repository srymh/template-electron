import { flexRender } from '@tanstack/react-table'
import type { Column, Table } from '@tanstack/react-table'
import { ArrowDown, ArrowDownUp, ArrowUp, FilterXIcon } from 'lucide-react'

import { cn } from '@repo/ui/lib/utils'

import { Filter } from '../controls/filter'
import { HeaderActionMenu } from './action-menu'

export function TableHeader<T>(props: {
  table: Table<T>
  showFilters: boolean
  getCommonPinningStyles: (column: Column<T>) => React.CSSProperties
}) {
  'use no memo'

  const { table, showFilters, getCommonPinningStyles } = props

  const isResizingId = table.getState().columnSizingInfo.isResizingColumn

  return (
    <thead className="bg-background text-foreground sticky top-0 z-20">
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            return (
              <th
                key={header.id}
                colSpan={header.colSpan}
                className={cn(
                  'px-4 py-3 text-left bg-background relative border-b border-b-border',
                  {
                    'select-none': isResizingId,
                  },
                )}
                style={{
                  width: `calc(var(--header-${header.id}-size) * 1px)`,
                  ...getCommonPinningStyles(header.column),
                }}
              >
                {header.isPlaceholder ? null : (
                  <>
                    <div className="overflow-hidden flex flex-nowrap items-center">
                      <div
                        className={cn(
                          'overflow-hidden flex flex-nowrap items-center flex-1',
                          header.column.getCanSort()
                            ? 'cursor-pointer select-none hover:text-blue-400 transition-colors truncate'
                            : '',
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex-1 truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                        {header.column.getCanSort() && (
                          <div className="w-4 flex items-center justify-center">
                            {{
                              asc: <ArrowUp />,
                              desc: <ArrowDown />,
                            }[header.column.getIsSorted() as string] ?? (
                              <ArrowDownUp className="opacity-50" />
                            )}
                          </div>
                        )}
                      </div>
                      {header.column.getCanFilter() && header.column.getIsFiltered() && (
                        <div
                          className="w-4 flex items-center justify-center hover:text-blue-400 cursor-pointer"
                          onClick={() => header.column.setFilterValue(undefined)}
                        >
                          <FilterXIcon />
                        </div>
                      )}
                      <div className="w-4 flex items-center justify-center">
                        <HeaderActionMenu header={header} />
                      </div>
                    </div>
                    {showFilters && header.column.getCanFilter() ? (
                      <div className="mt-2">
                        <Filter column={header.column} />
                      </div>
                    ) : null}
                    {header.column.getCanResize() && (
                      <div
                        {...{
                          onDoubleClick: () => header.column.resetSize(),
                          onMouseDown: header.getResizeHandler(),
                          onTouchStart: header.getResizeHandler(),
                        }}
                        className={cn(
                          'absolute top-0 right-0 h-full w-1 hover:bg-gray-500 cursor-ew-resize transition-colors',
                          {
                            'bg-gray-500': isResizingId === header.id,
                          },
                        )}
                      />
                    )}
                  </>
                )}
              </th>
            )
          })}
        </tr>
      ))}
    </thead>
  )
}
