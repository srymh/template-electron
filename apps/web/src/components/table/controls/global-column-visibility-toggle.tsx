import * as React from 'react'

import type { Table } from '@tanstack/react-table'
import { EyeIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Checkbox } from '@repo/ui/components/checkbox'
import { Label } from '@repo/ui/components/label'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'

/**
 * グローバル列表示切替えコンポーネント
 * @param props.table テーブルインスタンス
 */
export function GlobalColumnVisibilityToggle<T>(props: { table: Table<T> }) {
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
              {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
            </Label>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
