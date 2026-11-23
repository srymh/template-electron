import { Fragment } from 'react'
import type { ComponentProps, ReactNode, Ref } from 'react'

import { DragDropProvider } from '@dnd-kit/react'
import type { Header } from '@tanstack/react-table'

import { getColumnLabel } from '../column-label'
import type { ColumnRegion } from '../column-pinning'
import type { DataTableContexts } from '../contexts'
import type { ComponentRowData, DataTableCoreTable, DataTableFeatures } from '../features'
import { ColumnDropIndicator } from './column-drop-indicator'
import { getColumnDropPosition, isColumnDragData, readColumnEdges } from './column-drop-position'

/**
 * factoryのコンテキストへ、Headを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createHead<TMeta extends object>(contexts: DataTableContexts<TMeta>) {
  const { useTableContext } = contexts

  type DragDropProviderProps = ComponentProps<typeof DragDropProvider>

  /**
   * `<table.AppTable>` の中で、ヘッダーグループを `thead` に描画する。
   *
   * @remarks
   * 縦スクロール時は `thead` 全体を上端に固定し、本文の固定行・固定列（z-index 25 以下）より前面に置く。
   * 各ヘッダーの描画は `children` に任せ、ヘッダーと、その列の固定領域・
   * 領域内での位置を渡す。通常は `<table.AppHeader>` と `header.Cell` で描画する。
   * placeholder のヘッダーは `children` を呼ばず、空の見出しセルにする。
   * 列のドラッグ並べ替えを、同じ固定領域の中だけで受け付ける。ドラッグ中は表の並びと列幅を変えず、
   * 移動先の印だけを表の外の層に描き（`ColumnDropIndicator`）、離したときに列順を変える。
   * `ref` は `thead` 要素に渡す。
   */
  function Head({
    ref,
    children,
  }: {
    ref?: Ref<HTMLTableSectionElement>
    children: (
      header: Header<DataTableFeatures<TMeta>, ComponentRowData>,
      placement: { region: ColumnRegion; index: number },
    ) => ReactNode
  }) {
    const table = useTableContext()

    // ドラッグ中は表を変えず、離した時点のポインターの位置から移動先を求めて、列順を1回だけ変える
    const handleDragEnd: DragDropProviderProps['onDragEnd'] = (event) => {
      if (event.canceled) return

      const { source, position } = event.operation
      const headerRow = source?.element?.closest('tr')
      if (!source || !headerRow || !isColumnDragData(source.data)) return

      const { region, index } = source.data
      const dropPosition = getColumnDropPosition(
        readColumnEdges(headerRow, region),
        String(source.id),
        position.current.x,
      )
      if (!dropPosition || dropPosition.toIndex === index) return

      moveColumnInRegion(table, region, index, dropPosition.toIndex)
    }

    const getHeaderLabel = (columnId: string) => {
      const column = table.getColumn(columnId)
      return column ? getColumnLabel(column) : columnId
    }

    return (
      <DragDropProvider onDragEnd={handleDragEnd}>
        <ColumnDropIndicator getColumnLabel={getHeaderLabel} />
        <thead ref={ref} className="sticky top-0 z-30">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                if (header.isPlaceholder) {
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan > 1 ? header.colSpan : undefined}
                      className="bg-muted border-b"
                    />
                  )
                }
                const region = getColumnRegion(header)
                return (
                  <Fragment key={header.id}>
                    {children(header, {
                      region,
                      // ドラッグの位置は固定領域の中での位置で表す
                      index: headerGroup.headers
                        .filter((h) => getColumnRegion(h) === region)
                        .indexOf(header),
                    })}
                  </Fragment>
                )
              })}
            </tr>
          ))}
        </thead>
      </DragDropProvider>
    )
  }

  function getColumnRegion(
    header: Header<DataTableFeatures<TMeta>, ComponentRowData>,
  ): ColumnRegion {
    return header.column.getIsPinned() || 'center'
  }

  /**
   * 固定領域の中で、表示中の列を `fromIndex` から `toIndex` へ移す。
   *
   * @remarks
   * 固定した領域の並びは列の固定状態が、中央の並びは列順の状態が決めるため、
   * 領域に応じて更新する状態を切り替える。非表示の列は元の位置に残す。
   *
   * @param table - 更新するテーブル
   * @param region - 列を移す固定領域
   * @param fromIndex - 移動前の、領域内の表示中の列での位置
   * @param toIndex - 移動後の、領域内の表示中の列での位置
   * @returns 値は返さない。位置が範囲外の場合は状態を変えない
   */
  function moveColumnInRegion(
    table: DataTableCoreTable<ComponentRowData, TMeta>,
    region: ColumnRegion,
    fromIndex: number,
    toIndex: number,
  ) {
    const regionColumns =
      region === 'start'
        ? table.getStartVisibleLeafColumns()
        : region === 'end'
          ? table.getEndVisibleLeafColumns()
          : table.getCenterVisibleLeafColumns()
    const regionColumnIds = regionColumns.map((column) => column.id)
    const movedColumnIds = [...regionColumnIds]
    const [movedColumnId] = movedColumnIds.splice(fromIndex, 1)

    if (movedColumnId == null || toIndex < 0 || toIndex > movedColumnIds.length) return

    movedColumnIds.splice(toIndex, 0, movedColumnId)

    // 領域に含まれる列の位置だけを、移動後の並びで置き換える
    const replaceRegionOrder = (order: string[]) => {
      let next = 0
      return order.map((id) => (regionColumnIds.includes(id) ? movedColumnIds[next++]! : id))
    }

    if (region === 'center') {
      // `columnOrder` は空の場合やすべての列を含まない場合があるため、現在の表示順をもとに作る
      const displayingColumnOrder = table.getAllLeafColumns().map((column) => column.id)
      table.setColumnOrder(replaceRegionOrder(displayingColumnOrder))
    } else {
      table.setColumnPinning((old) => ({ ...old, [region]: replaceRegionOrder(old[region]) }))
    }
  }

  return { Head }
}
