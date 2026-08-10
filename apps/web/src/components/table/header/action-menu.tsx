import type { Header } from '@tanstack/react-table'
import { EllipsisVertical, EyeOffIcon, FilterXIcon, PinIcon, PinOffIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'

/**
 * ヘッダーアクションメニューコンポーネント
 *
 * - 列フィルターのクリア
 * - 列の非表示
 * - 列の固定（左・右・解除）
 *
 * @param props.header ヘッダーインスタンス
 */
export function HeaderActionMenu<T>(props: { header: Header<T, unknown> }) {
  'use no memo'

  const { header } = props

  return (
    <Popover>
      <PopoverTrigger asChild>
        <EllipsisVertical size="16" className="hover:text-blue-400 cursor-pointer" />
      </PopoverTrigger>
      <PopoverContent className="p-2 bg-background text-foreground flex flex-col min-h-64 justify-start items-start gap-2">
        <Button
          className="justify-start w-full"
          variant="outline"
          size="default"
          onClick={() => header.column.setFilterValue(undefined)}
          disabled={!header.column.getCanFilter() || !header.column.getIsFiltered()}
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
          disabled={!header.column.getCanPin() || header.column.getIsPinned() === 'left'}
        >
          <PinIcon className="inline mr-1" />
          列を左に固定
        </Button>
        <Button
          className="justify-start w-full"
          variant="outline"
          size="default"
          onClick={() => header.column.pin('right')}
          disabled={!header.column.getCanPin() || header.column.getIsPinned() === 'right'}
        >
          <PinIcon className="inline mr-1" />
          列を右に固定
        </Button>
        <Button
          className="justify-start w-full"
          variant="outline"
          size="default"
          onClick={() => header.column.pin(false)}
          disabled={!header.column.getCanPin() || header.column.getIsPinned() === false}
        >
          <PinOffIcon className="inline mr-1" />
          列の固定を解除
        </Button>
      </PopoverContent>
    </Popover>
  )
}
