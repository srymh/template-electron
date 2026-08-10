import type { Table } from '@tanstack/react-table'
import { ArrowLeft, ArrowLeftToLine, ArrowRight, ArrowRightToLine } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { NativeSelect, NativeSelectOption } from '@repo/ui/components/native-select'
import { Separator } from '@repo/ui/components/separator'

export function Pagination<T>(props: { table: Table<T> }) {
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
      <NativeSelect value={table.getState().pagination.pageSize} onChange={handlePageSizeChange}>
        {[10, 20, 30, 40, 50].map((pageSize) => (
          <NativeSelectOption key={pageSize} value={pageSize}>
            {pageSize} 件 / ページ
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
