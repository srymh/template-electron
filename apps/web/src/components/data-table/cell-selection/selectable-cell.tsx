import { useEffect, useRef } from 'react'
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
  TdHTMLAttributes,
} from 'react'

import type { Cell, CellSelectionDirection, CellSelectionEdges } from '@tanstack/react-table'

import { cn } from '@repo/ui/lib/utils'

import type { DataTableContexts } from '../contexts'
import type { ComponentRowData, DataTableFeatures } from '../features'
import { navigateCellSelection } from './cell-navigation'
import { getNavigationGrid } from './navigation-grid'

/**
 * factoryのコンテキストへ、SelectableCellを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createSelectableCell<TMeta extends object>(contexts: DataTableContexts<TMeta>) {
  const { useTableContext } = contexts

  const directionByKey: Partial<Record<string, CellSelectionDirection>> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  }

  // タップとみなす指の移動量の上限（px）
  const tapMoveTolerance = 10

  const noEdge = '0 0 0 0 transparent'

  /** 本文のセルに共通の余白と境界線。 */
  const bodyCellClassName = 'border-r border-b px-2 py-1 align-middle'

  /** セルと、行単位の購読で求めたセル選択の表示状態。 */
  type SelectableCellState = {
    cell: Cell<DataTableFeatures<TMeta>, ComponentRowData>
    isCellSelected: boolean
    isFocused: boolean
    edges: CellSelectionEdges
    /** 現在の画面で Tab の到達先にするセルなら `true`。 */
    isTabStop: boolean
  }

  /**
   * 本文のセル（`td`）。セル選択が有効な列では、選択・キーボード移動の操作を持つ。
   *
   * @remarks
   * `state` には行単位の購読で更新された表示状態（`BodyCell` が受け取ったセルの表示状態）を渡す。
   * React Compiler でメモ化されたセルでも、選択・フォーカス・境界線の変更を受け取れる。
   * セルを選択できない場合（能力が無効、または列で無効）は、操作・`tabIndex`・
   * 文字列選択の抑止を付けず、通常のセルとして描画する。
   *
   * 操作の契約は次のとおり。
   * - マウス: ライブラリ標準の `getSelectionStartHandler`（mousedown）と
   *   `getSelectionExtendHandler`（mouseenter）に委ねる。単一選択、
   *   ドラッグでの範囲拡張、Shift による範囲の端の移動、Ctrl/Cmd による
   *   範囲の追加と除外は、ライブラリの既定に従う。主ボタン以外の押下では選択を開始しない。
   * - タッチ: 指を離した時点で、移動量が小さくキャンセルされていなければ、
   *   そのセルだけを選択する。スクロールの開始・キャンセルでは選択を変えない。
   *   範囲の拡張はスクロールと競合するため行わない。タップ後の互換マウスイベントで
   *   選択処理が重複しないよう、touch の `pointerdown` で既定動作を止める。
   * - ペン: 対応しない。互換マウスイベントにより動作する場合があっても保証しない。
   * - キーボード: 選択の起点セルだけが Tab で到達できる（roving tabindex）。
   *   起点が画面外なら、表示中の先頭の選択可能セルを到達先にする。
   *   矢印キーで起点を移動して1セルの選択にし、Shift と矢印キーで
   *   起点を固定したまま範囲を広げる。移動先は、キーを押した時点の表示順のグリッド（`getNavigationGrid`）で決める。
   *   起点が移動したときは、テーブル内にフォーカスがある場合だけ、新しい起点セルへフォーカスを移す。
   *
   * `className` は既定のクラスに追加する。`style` は選択範囲の境界線を表す
   * CSS 変数と合わせて `td` に渡す（同名の変数は境界線の値を優先する）。
   */
  function SelectableCell({
    children,
    state,
    className,
    style: styleProp,
  }: {
    children: ReactNode
    state: SelectableCellState
    className?: string
    style?: CSSProperties
  }) {
    const table = useTableContext()
    const ref = useRef<HTMLTableCellElement>(null)
    const tapRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
    // cell のメソッド経由の読み取りは React Compiler から見えないため、表示状態は props で受け取る
    const { cell, isCellSelected, isFocused, edges, isTabStop } = state
    const canSelect = cell.getCanSelect()

    useEffect(() => {
      const node = ref.current
      if (!isFocused || !node) return
      // テーブル外の操作（リセットのボタンなど）でフォーカスを奪わない
      if (node.closest('table')?.contains(document.activeElement)) node.focus()
    }, [isFocused])

    if (!canSelect) {
      return (
        <td ref={ref} style={styleProp} className={cn(bodyCellClassName, className)}>
          {children}
        </td>
      )
    }

    const style = {
      ...styleProp,
      '--cell-edge-top': edges.top ? '0 2px 0 0 var(--color-primary)' : noEdge,
      '--cell-edge-right': edges.right ? '-2px 0 0 0 var(--color-primary)' : noEdge,
      '--cell-edge-bottom': edges.bottom ? '0 -2px 0 0 var(--color-primary)' : noEdge,
      '--cell-edge-left': edges.left ? '2px 0 0 0 var(--color-primary)' : noEdge,
    } as CSSProperties

    // 選択を開始・拡張する操作。タッチは指を離した時点で1セルだけを選ぶ
    const handlers: TdHTMLAttributes<HTMLTableCellElement> = {
      onMouseDown: (event: MouseEvent<HTMLTableCellElement>) => {
        if (event.button !== 0) return
        cell.getSelectionStartHandler()(event)
      },
      onMouseEnter: cell.getSelectionExtendHandler(),
      onPointerDown: (event: PointerEvent<HTMLTableCellElement>) => {
        if (event.pointerType !== 'touch') return
        // pointerdown の既定動作を止めると、互換マウスイベント（mousedown など）が発生しない。
        // スクロールは touch-action で決まるため、この呼び出しでは止まらない。
        event.preventDefault()
        tapRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
      },
      onPointerMove: (event: PointerEvent<HTMLTableCellElement>) => {
        const tap = tapRef.current
        if (!tap || tap.pointerId !== event.pointerId) return
        if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > tapMoveTolerance) {
          tapRef.current = null
        }
      },
      onPointerUp: (event: PointerEvent<HTMLTableCellElement>) => {
        const tap = tapRef.current
        tapRef.current = null
        if (tap?.pointerId === event.pointerId) table.setFocusedCell(cell.row.id, cell.column.id)
      },
      onPointerCancel: () => {
        tapRef.current = null
      },
      onKeyDown: (event: KeyboardEvent<HTMLTableCellElement>) => {
        const direction = directionByKey[event.key]
        if (!direction) return
        event.preventDefault()
        table.setCellSelection((current) =>
          navigateCellSelection(getNavigationGrid(table), cell, direction, event.shiftKey, current),
        )
      },
    }

    return (
      <td
        ref={ref}
        data-selected-state={isFocused ? 'focused' : isCellSelected ? 'selected' : undefined}
        tabIndex={isTabStop || isFocused ? 0 : -1}
        style={style}
        className={cn(
          bodyCellClassName,
          'focus-visible:outline-ring cursor-cell [box-shadow:inset_var(--cell-edge-top),inset_var(--cell-edge-right),inset_var(--cell-edge-bottom),inset_var(--cell-edge-left)] select-none focus-visible:outline-2 focus-visible:-outline-offset-2',
          // 固定列のセルでも下の内容が透けないよう、背景色と混ぜた不透明な色にする
          'data-[selected-state=focused]:bg-[color-mix(in_oklab,var(--color-primary)_25%,var(--color-background))] data-[selected-state=selected]:bg-[color-mix(in_oklab,var(--color-primary)_10%,var(--color-background))]',
          className,
        )}
        {...handlers}
      >
        {children}
      </td>
    )
  }

  return { SelectableCell }
}
