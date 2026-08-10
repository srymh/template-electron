import * as React from 'react'

import { createColumnHelper } from '@tanstack/react-table'
import type { CellContext, HeaderContext } from '@tanstack/react-table'

import { Checkbox } from '@repo/ui/components/checkbox'

export function usePinColumn<T>() {
  const pinColumn = React.useMemo(() => createPinColumn<T>(), [])

  return { pinColumn, id: pinColumn.id! }
}

function createPinColumn<T>() {
  return createColumnHelper<T>().display({
    id: '__pin',
    header: RowPinHeader,
    cell: RowPinCell,
    enableColumnFilter: false,
    enableSorting: false,
    enableResizing: false,
    size: 80,
    minSize: 80,
    maxSize: 80,
  })
}

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
      className="cursor-pointer"
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
      className="cursor-pointer"
    />
  )
}
