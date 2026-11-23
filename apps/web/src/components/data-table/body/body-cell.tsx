import type { CSSProperties, ReactNode } from 'react'

import { FolderIcon, FolderOpenIcon } from 'lucide-react'

import { cn } from '@repo/ui/lib/utils'

import { createSelectableCell } from '../cell-selection/selectable-cell'
import { endPinnedColumnShadowClassName, startPinnedColumnShadowClassName } from '../column-pinning'
import type { DataTableContexts } from '../contexts'
import type { BodyCellState } from './row-render-state'

/**
 * factoryのコンテキストへ、BodyCellを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createBodyCell<TMeta extends object>(contexts: DataTableContexts<TMeta>) {
  const { SelectableCell } = createSelectableCell(contexts)

  /**
   * `<table.AppCell>` の中で、本文のセルを描画する。
   *
   * @remarks
   * 列の固定・幅、グループ化した行の表示、セル選択を扱う。
   * `state` には `BodyRow` の `children` が受け取った表示状態を渡す。
   * cell の参照は状態が変わっても同じなので、セルも表示に使う値も
   * コンテキストから読まず `state` で受け取る。
   *
   * 固定した列・行のセルは、下を通る内容が透けないよう不透明な背景にし、
   * 行の hover と行選択の背景を同じ色で重ねる。利用側の行属性で付けた
   * 背景色（`className`）は `tr` に付くため、固定したセルには表示されない。
   */
  function BodyCell({ children, state }: { children: ReactNode; state: BodyCellState<TMeta> }) {
    const { isPinned, isLastColumnOfStart, isFirstColumnOfEnd, start, after, minSize } = state.cell
    const isSticky = Boolean(isPinned) || Boolean(state.row.isPinned)

    return (
      <SelectableCell
        state={state.cell}
        style={
          {
            // 列幅を固定する表（table-layout: fixed）の列幅は、最初の行である見出しのセルの幅で決まるため、
            // 本文のセルには書かない。固定しない表では、列の size を最小幅として扱う
            '--cell-size': minSize === undefined ? undefined : `${minSize}px`,
            '--inline-start': `${start}px`,
            '--inline-end': `${after}px`,
          } as CSSProperties
        }
        className={cn(
          minSize !== undefined && 'min-w-(--cell-size)',
          isSticky && 'bg-background group-hover/row:bg-muted group-data-is-selected/row:bg-muted',
          isPinned === 'start' && 'sticky left-(--inline-start) z-20',
          isPinned === 'end' && 'sticky right-(--inline-end) z-10',
        )}
      >
        <GroupingCellContent state={state}>{children}</GroupingCellContent>
        {isLastColumnOfStart && <div aria-hidden className={startPinnedColumnShadowClassName} />}
        {isFirstColumnOfEnd && <div aria-hidden className={endPinnedColumnShadowClassName} />}
      </SelectableCell>
    )
  }

  /**
   * グループ化した行のセルの内容。
   *
   * @remarks
   * グループ列のセルは、子の件数付きの展開ボタンにする。それ以外の列の値は伏せ、
   * 集計しないことを示す表示に置き換える。選択・行固定などの表示用の列（値を持たない列）は、
   * グループ行でも操作できるようそのまま表示する。
   */
  function GroupingCellContent({
    children,
    state,
  }: {
    children: ReactNode
    state: BodyCellState<TMeta>
  }) {
    const { isGrouped: isRowGrouped, isExpanded, canExpand, subRowCount } = state.row
    const { cell, isCellGrouped, isPlaceholder, columnGroupedIndex } = state.cell

    const isDisplayColumn = cell.column.accessorFn === undefined
    if (!isCellGrouped && !isPlaceholder && (!isRowGrouped || isDisplayColumn)) return children

    if (isCellGrouped) {
      const Icon = isExpanded ? FolderOpenIcon : FolderIcon
      return (
        <button
          type="button"
          aria-expanded={canExpand ? isExpanded : undefined}
          onClick={cell.row.getToggleExpandedHandler()}
          className={cn('flex items-center gap-1 truncate', canExpand && 'cursor-pointer')}
        >
          <Icon aria-hidden className="size-3 shrink-0 fill-amber-400 text-amber-500" />
          {children}
          <span className="text-muted-foreground tabular-nums">({subRowCount})</span>
        </button>
      )
    }

    if (isPlaceholder && (columnGroupedIndex === 0 || !isRowGrouped)) {
      return <div className="text-muted-foreground ml-1">|</div>
    }

    return <div className="bg-muted h-2 w-full rounded-full" />
  }

  return { BodyCell }
}
