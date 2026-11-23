import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'

import { AutoScroller, Feedback, PointerSensor } from '@dnd-kit/dom'
import { useDragDropManager, useDraggable } from '@dnd-kit/react'
import type { Header, SortDirection } from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  GripHorizontalIcon,
  GripVerticalIcon,
  PinIcon,
  PinOffIcon,
} from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'

import { getColumnLabel } from '../column-label'
import { endPinnedColumnShadowClassName, startPinnedColumnShadowClassName } from '../column-pinning'
import type { ColumnRegion } from '../column-pinning'
import type { DataTableContexts } from '../contexts'
import { getTableMeta } from '../features'
import type { ComponentRowData, DataTableCoreTable, DataTableFeatures } from '../features'
import { createColumnFilters } from '../filter/column-filter'
import { getColumnDropPointerX, readColumnEdges } from './column-drop-position'
import type { ColumnDragData } from './column-drop-position'

/**
 * factoryのコンテキストへ、HeaderCellを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createHeaderCell<TMeta extends object>(contexts: DataTableContexts<TMeta>) {
  const { useHeaderContext, useTableContext } = contexts
  const { ColumnFilter, ColumnFilterClearButton } = createColumnFilters(contexts)

  const keyboardResizeStep = 10
  const keyboardResizeLargeStep = 50

  /**
   * `<table.AppHeader>` の中で、選んだ能力の操作を持つ見出しセル。
   *
   * @remarks
   * 次の操作と表示を1つのセルにまとめる。各操作は、対応する能力と列の
   * `enable*` の両方で有効な場合だけ表示する。
   * - 上端のハンドル: 同じ固定領域（`region`）の中での列のドラッグ並べ替え。
   *   `index` には、その領域の中での位置を渡す。
   * - グループ化の切り替え、ソートの切り替え（複数列のソートでは優先順位を示す）、列の固定・解除のボタン。
   * - 列フィルターを表示している間は、列の `meta.filterVariant` に応じた列フィルターと、その列だけのクリア。
   * - 列の固定・解除のボタンは、表示設定 `showColumnPinningButtons` が `true` の間だけ表示する。
   * - グループ化ボタンも表示設定で切り替え、既定では固定ボタンとともに隠す。
   * - 右端のハンドル: ドラッグ、または左右の矢印キーでの列幅の変更。
   *
   * header の参照はソート・固定・幅などが変わっても同じなので、
   * テーブルの状態を購読し、表示に使う値をスナップショットとして渡す。
   * 能力・表示設定は、`options` が変わるたびに作り直されるコンテキストのテーブルの `meta` から読む。
   */
  function HeaderCell({
    children,
    region,
    index,
  }: {
    children: ReactNode
    region: ColumnRegion
    index: number
  }) {
    const header = useHeaderContext()
    const table = useTableContext()

    return (
      <table.Subscribe selector={() => getHeaderSnapshot(header, table)}>
        {(snapshot) => (
          <HeaderCellContent header={header} region={region} index={index} snapshot={snapshot}>
            {children}
          </HeaderCellContent>
        )}
      </table.Subscribe>
    )
  }

  type HeaderSnapshot = ReturnType<typeof getHeaderSnapshot>

  function getHeaderSnapshot(
    header: Header<DataTableFeatures<TMeta>, ComponentRowData>,
    table: DataTableCoreTable<ComponentRowData, TMeta>,
  ) {
    const { column } = header
    const isPinned = column.getIsPinned()
    return {
      canSort: column.getCanSort(),
      isSorted: column.getIsSorted(),
      sortIndex: column.getSortIndex(),
      isMultiSorted: table.atoms.sorting.get().length > 1,
      canGroup: column.getCanGroup(),
      isGrouped: column.getIsGrouped(),
      canPin: column.getCanPin(),
      isPinned,
      isLastColumnOfStart: isPinned === 'start' && column.getIsLastColumn('start'),
      isFirstColumnOfEnd: isPinned === 'end' && column.getIsFirstColumn('end'),
      start: column.getStart('start') ?? 0,
      after: column.getAfter('end') ?? 0,
      size: header.getSize(),
      canResize: column.getCanResize(),
      isResizing: column.getIsResizing(),
      canFilter: column.getCanFilter() && column.columnDef.meta?.filterVariant !== undefined,
    }
  }

  /**
   * 見出しセルの描画。購読したスナップショットと表示設定から、`th` と各操作を組み立てる。
   * 内容の高さが異なる列も、余白を増やさずセル内で上下中央に配置する。
   *
   * @remarks
   * 列の固定・グループ化のボタンは、表示設定で表示する間だけ描画し、状態は変えない。
   */
  function HeaderCellContent({
    children,
    header,
    region,
    index,
    snapshot,
  }: {
    children: ReactNode
    header: Header<DataTableFeatures<TMeta>, ComponentRowData>
    region: ColumnRegion
    index: number
    snapshot: HeaderSnapshot
  }) {
    const table = useTableContext()
    const { capabilities, layout } = getTableMeta(table)
    const { column } = header
    const label = getColumnLabel(column)
    const canReorder = capabilities.columnOrdering
    const { tableFixed } = layout
    const showFilter = layout.showColumnFilters && snapshot.canFilter
    const {
      canSort,
      isSorted,
      sortIndex,
      isMultiSorted,
      canGroup,
      isGrouped,
      canPin,
      isPinned,
      isLastColumnOfStart,
      isFirstColumnOfEnd,
      start,
      after,
      size,
      canResize,
      isResizing,
    } = snapshot

    // 並べ替えのハンドルが、ドラッグで動かす要素として見出しのセルを使う。
    // ハンドルの登録は th の ref より先に行われるため、要素を state で持ち、付いた後にハンドルへ渡す
    const [headerCell, setHeaderCell] = useState<HTMLTableCellElement | null>(null)

    // 列幅の変更。キーボードでは矢印キーで一定量ずつ変え、Shift で大きく変える
    const handleResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      const sign = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (sign === 0) return
      event.preventDefault()
      const delta = sign * (event.shiftKey ? keyboardResizeLargeStep : keyboardResizeStep)
      const { minSize = 20, maxSize = Number.MAX_SAFE_INTEGER } = column.columnDef
      const nextSize = Math.min(Math.max(size + delta, minSize), maxSize)
      table.setColumnSizing((old) => ({ ...old, [column.id]: nextSize }))
    }

    return (
      <th
        ref={setHeaderCell}
        colSpan={header.colSpan > 1 ? header.colSpan : undefined}
        aria-sort={getAriaSort(isSorted, sortIndex)}
        data-is-pinned={isPinned || undefined}
        // 列のドラッグで、移動先を求めるために同じ固定領域の見出しを探す
        data-column-id={column.id}
        data-column-region={region}
        style={
          {
            '--cell-size': `${size}px`,
            '--inline-start': `${start}px`,
            '--inline-end': `${after}px`,
          } as CSSProperties
        }
        className={cn(
          'group/header bg-muted text-muted-foreground relative border-r border-b px-2 py-1 text-left align-middle font-medium whitespace-nowrap',
          tableFixed ? 'w-(--cell-size)' : 'min-w-(--cell-size)',
          'data-is-pinned:sticky data-[is-pinned="end"]:right-(--inline-end) data-[is-pinned="end"]:z-40 data-[is-pinned="start"]:left-(--inline-start) data-[is-pinned="start"]:z-50',
        )}
      >
        {canReorder && (
          <ColumnReorderHandle
            columnId={column.id}
            label={label}
            region={region}
            index={index}
            headerCell={headerCell}
          />
        )}

        {/* フィルターや操作の有無で内容の高さが違っても、セル全体の中央へ配置する。
          列幅を固定した表では、狭い列でもはみ出さないよう名前を省略表示し、収まらない分はこの枠で切り取る。
          固定列の影は枠の外に描くため、th ではなくこの枠で切り取る。 */}
        <div className={cn('flex min-w-0 flex-col gap-1', tableFixed && 'overflow-hidden')}>
          <div className="flex min-w-0 items-center gap-1">
            {canGroup && layout.showColumnGroupingButtons && (
              <Button
                size="icon-xs"
                variant={isGrouped ? 'secondary' : 'ghost'}
                aria-label={isGrouped ? `${label}のグループ化を解除` : `${label}でグループ化`}
                onClick={column.getToggleGroupingHandler()}
              >
                {isGrouped ? <CircleMinusIcon /> : <CirclePlusIcon />}
              </Button>
            )}

            {/* 名前とソート。ソートできる列は名前をボタンにする */}
            {canSort ? (
              <button
                type="button"
                className="hover:text-foreground inline-flex min-w-0 items-center gap-0.5"
                onClick={column.getToggleSortingHandler()}
              >
                <span className="min-w-0 truncate">{children}</span>
                {isSorted === 'asc' && <ArrowUpIcon aria-hidden className="size-3 shrink-0" />}
                {isSorted === 'desc' && <ArrowDownIcon aria-hidden className="size-3 shrink-0" />}
                {isSorted && isMultiSorted && (
                  <span className="text-[10px] tabular-nums">{sortIndex + 1}</span>
                )}
              </button>
            ) : (
              <div className="min-w-0 truncate">{children}</div>
            )}

            {canPin && layout.showColumnPinningButtons && (
              <span className="ml-auto flex shrink-0 items-center opacity-60 group-hover/header:opacity-100">
                {isPinned ? (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`${label}の列の固定を解除`}
                    onClick={() => column.pin(false)}
                  >
                    <PinOffIcon />
                  </Button>
                ) : (
                  <>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`${label}の列を先頭に固定`}
                      onClick={() => column.pin('start')}
                    >
                      <PinIcon className="rotate-45" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`${label}の列を末尾に固定`}
                      onClick={() => column.pin('end')}
                    >
                      <PinIcon className="-rotate-45" />
                    </Button>
                  </>
                )}
              </span>
            )}
          </div>

          {/* 列フィルターと、この列だけの条件のクリア */}
          {showFilter && (
            <div className="flex min-w-0 items-center gap-0.5 font-normal">
              <div className="min-w-0 flex-1">
                <ColumnFilter column={column} />
              </div>
              <ColumnFilterClearButton column={column} />
            </div>
          )}
        </div>

        {canResize && (
          <button
            type="button"
            aria-label={`${label}の列幅を変更`}
            // ドラッグ中にタッチでページがスクロールしないよう touch-none にする
            className={cn(
              'hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:outline-ring absolute inset-y-0 right-0 flex w-1.5 cursor-col-resize touch-none items-center justify-center opacity-0 group-hover/header:opacity-100 focus-visible:opacity-100 focus-visible:outline-2',
              isResizing && 'bg-foreground/10 opacity-100',
            )}
            onMouseDown={header.getResizeHandler()}
            onTouchStart={header.getResizeHandler()}
            onKeyDown={handleResizeKeyDown}
          >
            <GripVerticalIcon aria-hidden className="size-2 shrink-0" />
          </button>
        )}

        {isLastColumnOfStart && <div aria-hidden className={startPinnedColumnShadowClassName} />}
        {isFirstColumnOfEnd && <div aria-hidden className={endPinnedColumnShadowClassName} />}
      </th>
    )
  }

  /**
   * 見出しのセルの上端に置く、列のドラッグ並べ替えのハンドル。
   *
   * @remarks
   * 並べ替えの能力が有効な間だけ描画し、その間だけ列をドラッグの対象として登録する。
   * dnd-kit はドラッグの開始点に `role` などの属性を付けるため、開始点を常にこのボタンにして、
   * 見出しのセル（`th`）を支援技術から見出しのまま扱えるようにする。
   * ドラッグ中は表を動かさず（`feedback: 'none'`）、移動先は `Head` の `ColumnDropIndicator` が描く。
   * 移動先は固定領域（`region`）の中に限り、確定は `Head` が行う。
   *
   * キーボードでは Tab でハンドルへ移動し、Space または Enter で開始、左右の矢印キーで1列ずつ移動、
   * Space または Enter で確定、Escape で取り消す。ポインターと同じ計算で移動先を決めるため、
   * 移動先の列の位置へドラッグの座標を動かす。
   */
  function ColumnReorderHandle({
    columnId,
    label,
    region,
    index,
    headerCell,
  }: {
    columnId: string
    label: string
    region: ColumnRegion
    index: number
    headerCell: HTMLTableCellElement | null
  }) {
    const data: ColumnDragData = { label, region, index }
    const { handleRef } = useDraggable({
      id: columnId,
      element: headerCell,
      data,
      // キーボードはこの部品で扱うため、既定の KeyboardSensor を外す
      sensors: [PointerSensor],
      plugins: [Feedback.configure({ feedback: 'none' })],
    })
    const manager = useDragDropManager()
    // キーボードでドラッグしている間の移動先と、ドラッグを止めて止めた自動スクロールを戻す処理
    const keyboardDragRef = useRef<{
      toIndex: number
      end: (event: Event | undefined, canceled: boolean) => void
    }>(undefined)

    const endKeyboardDrag = (event: Event | undefined, canceled: boolean) => {
      const keyboardDrag = keyboardDragRef.current
      keyboardDragRef.current = undefined
      keyboardDrag?.end(event, canceled)
    }

    // 並べ替えを無効にするなどでドラッグ中にハンドルが外れると blur が起きないため、外れるときに取り消す。
    // 同じ反映の中では、ドラッグの終了を受け取る側（印の部品など）の購読も張り替え中で、
    // すぐに止めると終了を取り逃がすため、反映が終わってから止める
    useEffect(
      () => () => {
        const keyboardDrag = keyboardDragRef.current
        keyboardDragRef.current = undefined
        if (keyboardDrag) queueMicrotask(() => keyboardDrag.end(undefined, true))
      },
      [],
    )

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      const headerRow = headerCell?.closest('tr')
      if (!manager || !headerCell || !headerRow) return
      const isConfirmKey = event.key === ' ' || event.key === 'Enter'
      const keyboardDrag = keyboardDragRef.current

      // 開始。ドラッグの座標は見出しのセルの中央から始める
      if (!keyboardDrag) {
        if (!isConfirmKey || !manager.dragOperation.status.idle) return
        event.preventDefault()
        const { left, right, top, bottom } = headerCell.getBoundingClientRect()
        const controller = manager.actions.start({
          event: event.nativeEvent,
          source: columnId,
          coordinates: { x: (left + right) / 2, y: (top + bottom) / 2 },
        })
        if (controller.signal.aborted) return
        // ドラッグの座標が表の端に近いと自動でスクロールするため、キーボードの間は止める
        const autoScroller = manager.registry.plugins.get(AutoScroller)
        const disablesAutoScroll = autoScroller?.disabled === false
        if (disablesAutoScroll) autoScroller.disable()
        keyboardDragRef.current = {
          toIndex: index,
          end: (endEvent, canceled) => {
            manager.actions.stop({ event: endEvent, canceled })
            if (disablesAutoScroll) autoScroller.enable()
          },
        }
        return
      }

      // 確定・取り消し
      if (isConfirmKey || event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        endKeyboardDrag(event.nativeEvent, event.key === 'Escape')
        return
      }

      // 左右の矢印キーで、移動先を1列ずつ動かす
      const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
      if (step === 0) return
      event.preventDefault()
      event.stopPropagation()
      const columns = readColumnEdges(headerRow, region)
      const toIndex = Math.min(Math.max(keyboardDrag.toIndex + step, 0), columns.length - 1)
      keyboardDrag.toIndex = toIndex
      // 移動先の隣の列が見えるようにスクロールしてから、移動後の位置で座標を求める
      const others = columns.filter((column) => column.id !== columnId)
      const neighborId = others[Math.min(toIndex, others.length - 1)]?.id
      const neighborCell = [...headerRow.cells].find((cell) => cell.dataset.columnId === neighborId)
      neighborCell?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const x = getColumnDropPointerX(readColumnEdges(headerRow, region), columnId, toIndex)
      if (x === undefined) return
      const { top, bottom } = headerCell.getBoundingClientRect()
      manager.actions.move({ event: event.nativeEvent, to: { x, y: (top + bottom) / 2 } })
    }

    return (
      <button
        type="button"
        ref={handleRef}
        aria-label={`${label}の列を並べ替える`}
        onKeyDown={handleKeyDown}
        // フォーカスが外れたら、キーボードでのドラッグを取り消す
        onBlur={() => endKeyboardDrag(undefined, true)}
        className="hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:outline-ring absolute inset-x-0 top-0 flex h-1.5 cursor-grab items-center justify-center opacity-0 group-hover/header:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 active:cursor-grabbing"
      >
        <GripHorizontalIcon aria-hidden className="size-2" />
      </button>
    )
  }

  // 複数列のソートでは、主となる1列（ソート順の先頭）だけに aria-sort を付ける
  function getAriaSort(isSorted: false | SortDirection, sortIndex: number) {
    if (sortIndex !== 0) return undefined
    return isSorted === 'asc' ? 'ascending' : isSorted === 'desc' ? 'descending' : undefined
  }

  return { HeaderCell }
}
