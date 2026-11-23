import { Fragment } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

import type { Cell, Row } from '@tanstack/react-table'

import { cn } from '@repo/ui/lib/utils'

import type { DataTableContexts } from '../contexts'
import type { ComponentRowData, DataTableFeatures } from '../features'
import { createRowRenderState } from './row-render-state'
import type { BodyCellState } from './row-render-state'
import type { PinnedRowOffsets } from './use-pinned-row-offsets'

/**
 * factoryのコンテキストへ、BodyRowを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createBodyRow<TMeta extends object>(contexts: DataTableContexts<TMeta>) {
  const { useTableContext } = contexts
  const { getRowChangeKey, getRowRenderState } = createRowRenderState<TMeta>()

  // 上端に固定した行のうち、最後の行の下側に影を付ける
  const topPinnedRowsShadowClassName =
    'data-is-last-row-of-top:[&>td]:border-b-0 data-is-last-row-of-top:after:pointer-events-none data-is-last-row-of-top:after:absolute data-is-last-row-of-top:after:-bottom-3 data-is-last-row-of-top:after:left-0 data-is-last-row-of-top:after:h-3 data-is-last-row-of-top:after:w-full data-is-last-row-of-top:after:bg-linear-to-b data-is-last-row-of-top:after:from-foreground/10 data-is-last-row-of-top:after:to-transparent'

  // 下端に固定した行のうち、最初の行の上側に影を付ける
  const bottomPinnedRowShadowClassName =
    'data-is-first-row-of-bottom:after:pointer-events-none data-is-first-row-of-bottom:after:absolute data-is-first-row-of-bottom:after:-top-3 data-is-first-row-of-bottom:after:left-0 data-is-first-row-of-bottom:after:h-3 data-is-first-row-of-bottom:after:w-full data-is-first-row-of-bottom:after:bg-linear-to-t data-is-first-row-of-bottom:after:from-foreground/10 data-is-first-row-of-bottom:after:to-transparent'

  /**
   * `<table.AppTable>` の中で、本文の1行を描画する。
   *
   * @remarks
   * 行の固定（sticky）を扱い、表示中のセルを先頭側・中央・末尾側の固定領域の順に
   * 並べる。各セルの描画は `children` に任せ、セルと表示状態を渡す。
   * 通常は `<table.AppCell>` と `cell.Cell` で描画する。
   * `rowProps` は利用側の行属性で、`tr` に渡す（`className` は既定のクラスに追加する）。
   *
   * row や cell の参照は、多くの状態変更で同じまま保たれる。そのため行ごとに
   * テーブルの状態を購読し、表示に使う値が変わったときだけ描画し直す。
   * 購読では全セルの表示状態を読まず、変更を判定できる安価なキー（{@link getRowChangeKey}）だけを比べる。
   * セルの表示状態は、キーが変わった行の描画で1回だけ読む。
   *
   * 固定中だけ `getPinnedRowRef(row.id)` を `ref` に渡し、
   * `pinnedRowOffsets` の値を `top`・`bottom` に使う。
   */
  function BodyRow({
    row,
    pinnedRowOffsets,
    getPinnedRowRef,
    rowProps,
    children,
  }: {
    row: Row<DataTableFeatures<TMeta>, ComponentRowData>
    pinnedRowOffsets: PinnedRowOffsets
    getPinnedRowRef: (rowId: string) => (node: HTMLTableRowElement | null) => void
    rowProps?: HTMLAttributes<HTMLTableRowElement>
    children: (
      cell: Cell<DataTableFeatures<TMeta>, ComponentRowData>,
      state: BodyCellState<TMeta>,
    ) => ReactNode
  }) {
    const table = useTableContext()

    return (
      <table.Subscribe selector={() => getRowChangeKey(row, table)}>
        {() => {
          // 購読したキーは変更の検知だけに使い、描画する値はここで読む
          const state = getRowRenderState(row, table)
          const { isPinned, isLastRowOfTop, isFirstRowOfBottom, isLastRowOfCenter } = state
          const pinnedTop = isPinned === 'top' ? pinnedRowOffsets.top[row.id] : undefined
          const pinnedBottom = isPinned === 'bottom' ? pinnedRowOffsets.bottom[row.id] : undefined

          return (
            <tr
              {...rowProps}
              // 同じ行 ID には同じ ref callback を渡し、再レンダーごとに監視を登録し直さない
              ref={isPinned ? getPinnedRowRef(row.id) : undefined}
              data-is-selected={state.isSelected || undefined}
              data-is-pinned={isPinned || undefined}
              data-is-last-row-of-top={isLastRowOfTop || undefined}
              data-is-first-row-of-bottom={isFirstRowOfBottom || undefined}
              data-is-last-row-of-center={isLastRowOfCenter || undefined}
              style={
                {
                  ...rowProps?.style,
                  '--pinned-top': typeof pinnedTop === 'number' ? `${pinnedTop}px` : undefined,
                  '--pinned-bottom':
                    typeof pinnedBottom === 'number' ? `${pinnedBottom}px` : undefined,
                } as CSSProperties
              }
              className={cn(
                'group/row hover:bg-muted/50 data-is-selected:bg-muted data-[state=selected]:bg-primary/10 transition-colors',
                // 固定行は、固定列のセル（z-20）より前面、見出し（z-30）より背面に置く
                'data-is-pinned:sticky data-[is-pinned="bottom"]:bottom-(--pinned-bottom) data-[is-pinned="bottom"]:z-25 data-[is-pinned="top"]:top-(--pinned-top) data-[is-pinned="top"]:z-25',
                topPinnedRowsShadowClassName,
                bottomPinnedRowShadowClassName,
                rowProps?.className,
              )}
            >
              {state.cells.map((cellState) => (
                <Fragment key={cellState.cell.id}>
                  {children(cellState.cell, { row: state, cell: cellState })}
                </Fragment>
              ))}
            </tr>
          )
        }}
      </table.Subscribe>
    )
  }

  return { BodyRow }
}
