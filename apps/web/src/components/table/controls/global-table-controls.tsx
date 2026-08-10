import type { Table } from '@tanstack/react-table'
import { ArrowDownUp, EllipsisVertical, FilterXIcon, PinOffIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'

/**
 * グローバルテーブルコントロールコンポーネント
 * @param props
 * @returns
 */
export function GlobalTableControls<T>(props: {
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
            {isTableHeightFixed ? <span>固定しない</span> : <span>固定する</span>}
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
