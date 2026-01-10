import React from 'react'
import { createColumnHelper, flexRender } from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowDownUp,
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  ArrowUp,
  EllipsisVertical,
  EyeIcon,
  EyeOffIcon,
  FilterXIcon,
  ListFilter,
  PinIcon,
  PinOffIcon,
} from 'lucide-react'

import { NativeSelect, NativeSelectOption } from '../ui/native-select'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import type {
  CellContext,
  Column,
  Header,
  HeaderContext,
  Table,
} from '@tanstack/react-table'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { DebouncedInput } from '@/components/table/debounced-input'
import { Filter } from '@/components/table/filter'
import { cn } from '@/lib/utils'

export function BasicTable<T>(props: {
  table: Table<T>
  rerender?: () => void
  refreshData?: () => void
}) {
  'use no memo'

  const { table, rerender, refreshData } = props

  const pinColumn = React.useMemo(
    () =>
      createColumnHelper<T>().display({
        id: '__pin',
        header: RowPinHeader,
        cell: RowPinCell,
        enableColumnFilter: false,
        enableSorting: false,
        enableResizing: false,
        size: 80,
        minSize: 80,
        maxSize: 80,
      }),
    [],
  )

  // レンダー中に実行して、列がモデル計算に参加するようにする必要があります。
  // 重要: prev.columnsを変更しないでください。
  table.setOptions((prev) => {
    const columns = prev.columns

    const firstId = (columns[0] as any)?.id
    const hasPin =
      firstId === '__pin' || columns.some((col: any) => col?.id === '__pin')
    const needsResizeMode = prev.columnResizeMode !== 'onChange'

    // 変更がない場合は高速パス - ページネーションの自動リセットを回避します。
    if (hasPin && firstId === '__pin' && !needsResizeMode) {
      return prev
    }

    // ピン留め列を先頭に追加し、既存のピン留め列を削除します。
    const nextColumns =
      hasPin && firstId === '__pin'
        ? columns
        : [pinColumn, ...columns.filter((col: any) => col?.id !== '__pin')]

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnSizingInfo, table.getState().columnSizing])

  // These are the important styles to make sticky column pinning work!
  // Apply styles like this using your CSS strategy of choice with this kind of logic to head cells, data cells, footer cells, etc.
  // View the index.css file for more needed styles such as border-collapse: separate
  const getCommonPinningStyles = (column: Column<T>): React.CSSProperties => {
    const isPinned = column.getIsPinned()
    const isLastLeftPinnedColumn =
      isPinned === 'left' && column.getIsLastColumn('left')
    const isFirstRightPinnedColumn =
      isPinned === 'right' && column.getIsFirstColumn('right')

    return {
      boxShadow: isLastLeftPinnedColumn
        ? '-4px 0 4px -4px gray inset'
        : isFirstRightPinnedColumn
          ? '4px 0 4px -4px gray inset'
          : undefined,
      left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
      right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
      opacity: isPinned ? 0.95 : 1,
      position: isPinned ? 'sticky' : 'relative',
      width: column.getSize(),
      zIndex: isPinned ? 1 : 0,
    }
  }

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
        <Button
          variant="outline"
          size="default"
          onClick={() => setShowFilters(!showFilters)}
        >
          <ListFilter />
          <span className="ml-2">
            {showFilters ? 'フィルターを非表示' : 'フィルターを表示'}
          </span>
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
        className={cn(
          'w-full rounded-lg border border-border overflow-auto overscroll-none',
          {
            'h-(--table-height)': isTableHeightFixed,
          },
        )}
      >
        <table
          className={cn(
            'text-sm text-foreground table-fixed border-spacing-0 border-separate',
            {
              'min-w-full': isTableWidthFull,
              'w-full': isTableWidthFull,
              'w-(--table-total-width)': !isTableWidthFull,
            },
          )}
        >
          <TableHeader
            table={table}
            showFilters={showFilters}
            getCommonPinningStyles={getCommonPinningStyles}
          />
          <TableBody
            table={table}
            getCommonPinningStyles={getCommonPinningStyles}
          />
        </table>
      </div>
      <div className="h-4" />
      <Pagination table={table} />
      <DebugInfo table={table} rerender={rerender} refreshData={refreshData} />
    </div>
  )
}

// -----------------------------------------------------------------------------
// #region Controls

function RowPinHeader<T>(props: HeaderContext<T, unknown>) {
  'use no memo'

  const { table } = props

  return (
    <Checkbox
      checked={table.getIsSomeRowsPinned()}
      onCheckedChange={() => {
        if (table.getIsSomeRowsPinned()) {
          table.resetRowPinning()
        }
      }}
      disabled={!table.getIsSomeRowsPinned()}
      className="cursor-pointer bg-white dark:bg-white"
    />
  )
}

function RowPinCell<T>(props: CellContext<T, unknown>) {
  'use no memo'

  const { row } = props

  return (
    <Checkbox
      checked={!!row.getIsPinned()}
      onCheckedChange={(checked) => {
        if (checked) {
          row.pin('top')
        } else {
          row.pin(false)
        }
      }}
      className="cursor-pointer bg-white dark:bg-white"
    />
  )
}

/**
 * グローバル列表示切替えコンポーネント
 * @param props.table テーブルインスタンス
 */
function GlobalColumnVisibilityToggle<T>(props: { table: Table<T> }) {
  'use no memo'

  const { table } = props
  const idPrefix = React.useId()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="default">
          <EyeIcon />
          <span className="ml-2">列表示切替え</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2 bg-background text-foreground flex flex-col min-h-64 justify-start items-start gap-2">
        <div className="w-full">
          <Label
            htmlFor={`${idPrefix}_all`}
            className="flex items-center gap-2 w-full hover:text-blue-400 cursor-pointer"
          >
            <Checkbox
              id={`${idPrefix}_all`}
              checked={table.getIsAllColumnsVisible()}
              onCheckedChange={(checked) => {
                if (typeof checked === 'boolean') {
                  table.toggleAllColumnsVisible(checked)
                }
              }}
            />
            すべての列
          </Label>
        </div>
        {table.getAllColumns().map((column) => (
          <div key={column.id} className="w-full">
            <Label
              htmlFor={`${idPrefix}_${column.id}`}
              className="flex items-center gap-2 w-full hover:text-blue-400 cursor-pointer"
            >
              <Checkbox
                id={`${idPrefix}_${column.id}`}
                checked={column.getIsVisible()}
                onCheckedChange={(checked) => {
                  if (typeof checked === 'boolean') {
                    column.toggleVisibility(checked)
                  }
                }}
              />
              {typeof column.columnDef.header === 'string'
                ? column.columnDef.header
                : column.id}
            </Label>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/**
 * グローバルテーブルコントロールコンポーネント
 * @param props
 * @returns
 */
function GlobalTableControls<T>(props: {
  table: Table<T>
  isTableWidthFull: boolean
  setIsTableWidthFull: (value: boolean) => void
  isTableHeightFixed: boolean
  setIsTableHeightFixed: (value: boolean) => void
}) {
  'use no memo'

  const {
    table,
    isTableWidthFull,
    setIsTableWidthFull,
    isTableHeightFixed,
    setIsTableHeightFixed,
  } = props
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="w-12" variant="outline" size="default">
          <EllipsisVertical />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2 bg-background text-foreground flex flex-col min-h-64 justify-start items-start gap-2">
        <Button
          className="w-full justify-start"
          variant="outline"
          size="default"
          onClick={() => setIsTableWidthFull(!isTableWidthFull)}
        >
          <div>
            <span>テーブル最低幅を</span>
            {isTableWidthFull ? <span>設定しない</span> : <span>設定する</span>}
          </div>
        </Button>
        <Button
          className="w-full justify-start"
          variant="outline"
          size="default"
          onClick={() => setIsTableHeightFixed(!isTableHeightFixed)}
        >
          <div>
            <span>テーブルの高さを</span>
            {isTableHeightFixed ? (
              <span>固定しない</span>
            ) : (
              <span>固定する</span>
            )}
          </div>
        </Button>
        <Button
          className="w-full justify-start"
          variant="outline"
          size="default"
          onClick={() => table.resetColumnFilters()}
          disabled={Object.keys(table.getState().columnFilters).length === 0}
        >
          <FilterXIcon />
          <span className="ml-2">フィルターをすべてクリア</span>
        </Button>
        <Button
          className="w-full justify-start"
          variant="outline"
          size="default"
          onClick={() => table.resetSorting()}
          disabled={table.getState().sorting.length === 0}
        >
          <ArrowDownUp />
          <span className="ml-2">ソートをすべてクリア</span>
        </Button>
        <Button
          className="w-full justify-start"
          variant="outline"
          size="default"
          onClick={() => table.resetColumnSizing()}
          disabled={Object.keys(table.getState().columnSizing).length === 0}
        >
          <span>列幅変更をすべてクリア</span>
        </Button>
        <Button
          className="w-full justify-start"
          variant="outline"
          size="default"
          onClick={() => table.resetColumnPinning()}
          disabled={
            table.getState().columnPinning.left?.length === 0 &&
            table.getState().columnPinning.right?.length === 0
          }
        >
          <PinOffIcon />
          <span className="ml-2">列の固定をすべてクリア</span>
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/**
 * グローバルフィルターコンポーネント
 * @param props.globalFilter グローバルフィルター値
 * @param props.onChangeGlobalFilter グローバルフィルター変更ハンドラ
 */
function GlobalFilter(props: {
  globalFilter: string
  onChangeGlobalFilter: (value: string) => void
}) {
  'use no memo'

  const { globalFilter = '', onChangeGlobalFilter } = props

  const handleChange = (value: string | number) => {
    onChangeGlobalFilter(String(value))
  }

  return (
    <div>
      <DebouncedInput
        value={globalFilter}
        onChange={handleChange}
        className="w-full"
        placeholder="すべての列を検索..."
      />
    </div>
  )
}

// #endregion

// -----------------------------------------------------------------------------
// #region Header

function TableHeader<T>(props: {
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
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
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
                      {header.column.getCanFilter() &&
                        header.column.getIsFiltered() && (
                          <div
                            className="w-4 flex items-center justify-center hover:text-blue-400 cursor-pointer"
                            onClick={() =>
                              header.column.setFilterValue(undefined)
                            }
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

/**
 * ヘッダーアクションメニューコンポーネント
 *
 * - 列フィルターのクリア
 * - 列の非表示
 * - 列の固定（左・右・解除）
 *
 * @param props.header ヘッダーインスタンス
 */
function HeaderActionMenu<T>(props: { header: Header<T, unknown> }) {
  'use no memo'

  const { header } = props

  return (
    <Popover>
      <PopoverTrigger asChild>
        <EllipsisVertical
          size="16"
          className="hover:text-blue-400 cursor-pointer"
        />
      </PopoverTrigger>
      <PopoverContent className="p-2 bg-background text-foreground flex flex-col min-h-64 justify-start items-start gap-2">
        <Button
          className="justify-start w-full"
          variant="outline"
          size="default"
          onClick={() => header.column.setFilterValue(undefined)}
          disabled={
            !header.column.getCanFilter() || !header.column.getIsFiltered()
          }
        >
          <FilterXIcon className="inline mr-1" />
          フィルターをクリア
        </Button>
        <Button
          className="justify-start w-full"
          variant="outline"
          size="default"
          onClick={() => header.column.toggleVisibility()}
          disabled={!header.column.getCanHide()}
        >
          <EyeOffIcon className="inline mr-1" />
          列を非表示
        </Button>
        <Button
          className="justify-start w-full"
          variant="outline"
          size="default"
          onClick={() => header.column.pin('left')}
          disabled={
            !header.column.getCanPin() || header.column.getIsPinned() === 'left'
          }
        >
          <PinIcon className="inline mr-1" />
          列を左に固定
        </Button>
        <Button
          className="justify-start w-full"
          variant="outline"
          size="default"
          onClick={() => header.column.pin('right')}
          disabled={
            !header.column.getCanPin() ||
            header.column.getIsPinned() === 'right'
          }
        >
          <PinIcon className="inline mr-1" />
          列を右に固定
        </Button>
        <Button
          className="justify-start w-full"
          variant="outline"
          size="default"
          onClick={() => header.column.pin(false)}
          disabled={
            !header.column.getCanPin() || header.column.getIsPinned() === false
          }
        >
          <PinOffIcon className="inline mr-1" />
          列の固定を解除
        </Button>
      </PopoverContent>
    </Popover>
  )
}

// #endregion

// -----------------------------------------------------------------------------
// #region Body

function TableBody<T>(props: {
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
            className={cn(
              'transition-colors group h-12 [&:last-child_td]:border-b-0',
              {
                sticky: row.getIsPinned() === 'top',
                'z-15': row.getIsPinned() === 'top',
              },
            )}
            style={{
              top:
                row.getIsPinned() === 'top'
                  ? `${row.getPinnedIndex() * 48 + 48 + 1}px`
                  : undefined,
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
          <tr
            key={row.id}
            className="transition-colors group h-12 [&:last-child_td]:border-b-0"
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
    </tbody>
  )
}

// #endregion

// -----------------------------------------------------------------------------
// #region Others

function Pagination<T>(props: { table: Table<T> }) {
  'use no memo'

  const { table } = props

  const handleClickFirst = () => table.setPageIndex(0)
  const handleClickLast = () => table.setPageIndex(table.getPageCount() - 1)
  const handlePreviousPage = () => table.previousPage()
  const handleNextPage = () => table.nextPage()
  const handleChangePage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = e.target.value ? Number(e.target.value) - 1 : 0
    table.setPageIndex(page)
  }
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    table.setPageSize(Number(e.target.value))
  }

  return (
    <div className="flex flex-wrap items-center gap-2 h-6">
      <Button
        variant="outline"
        size="icon"
        onClick={handleClickFirst}
        disabled={!table.getCanPreviousPage()}
      >
        <ArrowLeftToLine />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handlePreviousPage}
        disabled={!table.getCanPreviousPage()}
      >
        <ArrowLeft />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleNextPage}
        disabled={!table.getCanNextPage()}
      >
        <ArrowRight />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleClickLast}
        disabled={!table.getCanNextPage()}
      >
        <ArrowRightToLine />
      </Button>
      <Label className="flex items-center gap-1">
        ページ：
        <strong>
          {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
        </strong>
      </Label>
      <Separator orientation="vertical" />
      <Label className="flex items-center gap-1" htmlFor="go-to-page">
        ページへ移動：
        <Input
          id="go-to-page"
          type="number"
          defaultValue={table.getState().pagination.pageIndex + 1}
          onChange={handleChangePage}
          className="w-20"
          min={1}
          max={table.getPageCount()}
          value={table.getState().pagination.pageIndex + 1}
        />
      </Label>
      <NativeSelect
        value={table.getState().pagination.pageSize}
        onChange={handlePageSizeChange}
      >
        {[10, 20, 30, 40, 50].map((pageSize) => (
          <NativeSelectOption key={pageSize} value={pageSize}>
            {pageSize} 件 / ページ
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

function DebugInfo<T>(props: {
  table: Table<T>
  rerender?: () => void
  refreshData?: () => void
}) {
  'use no memo'

  const { table, rerender, refreshData } = props

  return (
    <>
      <div className="mt-4 text-gray-400">
        {table.getPrePaginationRowModel().rows.length} Rows
      </div>
      <div className="mt-4 flex gap-2">
        {rerender && (
          <button
            onClick={() => rerender()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Force Rerender
          </button>
        )}
        {refreshData && (
          <button
            onClick={() => refreshData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Refresh Data
          </button>
        )}
      </div>
      <pre className="mt-4 p-4 bg-gray-800 rounded-lg text-gray-300 overflow-auto">
        {JSON.stringify(table.getState(), null, 2)}
      </pre>
    </>
  )
}

// #endregion
