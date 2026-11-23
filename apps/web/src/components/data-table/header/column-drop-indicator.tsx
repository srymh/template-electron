import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { Draggable } from '@dnd-kit/dom'
import { useDragDropMonitor } from '@dnd-kit/react'

import { getColumnDropPosition, isColumnDragData, readColumnEdges } from './column-drop-position'

/** 画面上の矩形。`position: fixed` の要素の配置に使う。 */
type Box = { left: number; top: number; width: number; height: number }

/** 列のドラッグ中に描く印の配置。ドラッグ中だけ持つ。 */
type DropIndicatorLayout = {
  label: string
  /** ドラッグ中の列の見出しのセル。薄く覆う。 */
  source: Box
  /** 差し込む位置の縦線。元の位置から動かない場合は描かない。 */
  boundary: Box | undefined
  /** 列の名前の札を置く位置（ポインターの位置）。 */
  pointer: { x: number; y: number }
}

/**
 * 列のドラッグ中に、移動先を表の外の層に描く。
 *
 * @remarks
 * 表の DOM の並びや列幅は変えず、`position: fixed` の要素だけを `document.body` に描く。
 * - ドラッグ中の列の見出しのセルを薄く覆う。
 * - 差し込む位置の境界に、見出しの高さの縦線を引く。元の位置から動かない場合は引かない。
 * - ポインターの近くに、ドラッグ中の列の名前の札を出す。
 * 印は表のスクロール領域の中に切り詰める。移動先が変わったときは、読み上げ用の領域で知らせる。
 * ポインターでのドラッグでは、スクロール領域の左右の端に近づくと横にスクロールする（`useEdgeAutoScroll`）。
 * `DragDropProvider` の中に置き、`getColumnLabel` で列の ID から表示名を求める。
 */
export function ColumnDropIndicator({
  getColumnLabel,
}: {
  getColumnLabel: (columnId: string) => string
}) {
  const [layout, setLayout] = useState<DropIndicatorLayout>()
  const [announcement, setAnnouncement] = useState('')
  // スクロールで見出しが動いたときに測り直すため、最後のドラッグ元とポインターを持つ。
  // キーボードでのドラッグは移動先の列へスクロールするため、端の自動スクロールはポインターに限る
  const dragRef = useRef<{
    source: Draggable
    pointer: { x: number; y: number }
    isPointer: boolean
  }>(undefined)
  const lastTargetRef = useRef<string>(undefined)
  const edgeAutoScroll = useEdgeAutoScroll()

  // ドラッグ元とポインターの位置から、印の配置と読み上げの文を求める
  const measure = (source: Draggable, pointer: { x: number; y: number }) => {
    const { data, element } = source
    const headerRow = element?.closest('tr')
    if (!isColumnDragData(data) || !element || !headerRow) return

    const columns = readColumnEdges(headerRow, data.region)
    const position = getColumnDropPosition(columns, String(source.id), pointer.x)
    const scrollContainer = getScrollContainer(element)
    const clip = scrollContainer?.getBoundingClientRect() ?? {
      left: 0,
      right: window.innerWidth,
      top: 0,
      bottom: window.innerHeight,
    }
    if (dragRef.current?.isPointer) edgeAutoScroll.update(scrollContainer, pointer.x, clip)
    const sourceRect = intersect(element.getBoundingClientRect(), clip)
    const rowRect = headerRow.getBoundingClientRect()
    const moves = position !== undefined && position.toIndex !== position.fromIndex
    const boundaryX = moves ? Math.min(Math.max(position.boundaryX, clip.left), clip.right) : 0

    setLayout({
      label: data.label,
      source: sourceRect,
      boundary: moves
        ? { left: boundaryX - 1, top: rowRect.top, width: 2, height: rowRect.height }
        : undefined,
      pointer,
    })

    // 移動先が変わったときだけ読み上げる
    const others = columns.filter((column) => column.id !== String(source.id))
    const target = !moves
      ? `${data.label}は元の位置`
      : position.toIndex < others.length
        ? `${data.label}を${getColumnLabel(others[position.toIndex]!.id)}の前へ`
        : `${data.label}を${getColumnLabel(others.at(-1)!.id)}の後ろへ`
    if (lastTargetRef.current !== target) {
      lastTargetRef.current = target
      setAnnouncement(target)
    }
  }

  // ドラッグ中に表がスクロールしたら（自動スクロールを含む）、同じポインターの位置で測り直す
  const handleScroll = () => {
    if (dragRef.current) measure(dragRef.current.source, dragRef.current.pointer)
  }
  const stopScrollTrackingRef = useRef<() => void>(undefined)

  useDragDropMonitor({
    onDragStart(event) {
      const { source, position } = event.operation
      if (!source || !isColumnDragData(source.data)) return
      lastTargetRef.current = undefined
      dragRef.current = {
        source,
        pointer: position.current,
        isPointer: !(event.nativeEvent instanceof KeyboardEvent),
      }
      measure(source, position.current)
      document.addEventListener('scroll', handleScroll, { capture: true, passive: true })
      stopScrollTrackingRef.current = () =>
        document.removeEventListener('scroll', handleScroll, { capture: true })
    },
    onDragMove(event) {
      const { source, position } = event.operation
      if (!source || dragRef.current?.source !== source) return
      // dnd-kit はこのイベントを配った後に位置を更新するため、移動後の位置はイベントの値から求める
      const pointer = event.to ?? {
        x: position.current.x + (event.by?.x ?? 0),
        y: position.current.y + (event.by?.y ?? 0),
      }
      dragRef.current = { ...dragRef.current, pointer }
      measure(source, pointer)
    },
    onDragEnd(event) {
      if (!dragRef.current) return
      const { label } = dragRef.current.source.data as { label: string }
      dragRef.current = undefined
      edgeAutoScroll.stop()
      stopScrollTrackingRef.current?.()
      stopScrollTrackingRef.current = undefined
      setLayout(undefined)
      setAnnouncement(
        event.canceled ? `${label}の並べ替えを取り消しました` : `${label}を移動しました`,
      )
    },
  })

  // ドラッグ中に表が外れた場合も、スクロールの購読と自動スクロールを残さない。
  // 外れたときだけ片付ける（edgeAutoScroll は ref だけを読む）
  useEffect(
    () => () => {
      stopScrollTrackingRef.current?.()
      edgeAutoScroll.stop()
    },
    [],
  )

  return createPortal(
    <>
      {layout && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-100">
          {/* ドラッグ中の列の見出し */}
          <div className="bg-background/60 fixed" style={toStyle(layout.source)} />
          {/* 差し込む位置 */}
          {layout.boundary && (
            <div className="bg-primary fixed rounded-full" style={toStyle(layout.boundary)} />
          )}
          {/* ドラッグ中の列の名前 */}
          <div
            className="bg-popover text-popover-foreground fixed rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shadow-md"
            // 画面の右端に近いときは、画面の外に出ないようポインターの左に出す
            style={
              layout.pointer.x + labelFlipMargin > window.innerWidth
                ? { right: window.innerWidth - layout.pointer.x + 12, top: layout.pointer.y + 12 }
                : { left: layout.pointer.x + 12, top: layout.pointer.y + 12 }
            }
          >
            {layout.label}
          </div>
        </div>
      )}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>,
    document.body,
  )
}

/** 列の名前の札をポインターの左に出す、画面の右端からの距離（px）。 */
const labelFlipMargin = 200

function toStyle({ left, top, width, height }: Box) {
  return { left, top, width, height }
}

// 表のスクロール領域（横にはみ出す内容を切り取る最も近い祖先）
function getScrollContainer(element: Element) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (getComputedStyle(node).overflowX !== 'visible') return node
  }
  return undefined
}

/** スクロール領域の端から、自動スクロールを始める距離（px）。 */
const edgeScrollZone = 48
/** 端に最も近いときの、1フレームあたりのスクロール量（px）。 */
const edgeScrollMaxStep = 16

/**
 * ポインターがスクロール領域の左右の端に近い間、毎フレーム横にスクロールする。
 *
 * @remarks
 * dnd-kit の自動スクロールは、ドラッグ中に表を動かさない並べ替えでは働かなかったため、
 * 横方向だけをここで扱う。端に近いほど速くスクロールし、端から離れるか `stop` で止める。
 * スクロールで見出しが動いたときの測り直しは、呼び出し側のスクロールの購読に任せる。
 */
function useEdgeAutoScroll() {
  const stateRef = useRef<{ container: Element; step: number; frame: number }>(undefined)

  const stop = () => {
    if (stateRef.current) cancelAnimationFrame(stateRef.current.frame)
    stateRef.current = undefined
  }

  const update = (
    container: Element | undefined,
    pointerX: number,
    clip: { left: number; right: number },
  ) => {
    const leftDepth = clip.left + edgeScrollZone - pointerX
    const rightDepth = pointerX - (clip.right - edgeScrollZone)
    const depth = Math.max(leftDepth, rightDepth)
    if (!container || depth <= 0) {
      stop()
      return
    }

    const step =
      Math.sign(rightDepth - leftDepth) *
      Math.ceil((edgeScrollMaxStep * Math.min(depth, edgeScrollZone)) / edgeScrollZone)
    if (stateRef.current) {
      stateRef.current.container = container
      stateRef.current.step = step
      return
    }
    const scroll = () => {
      const state = stateRef.current
      if (!state) return
      state.container.scrollLeft += state.step
      state.frame = requestAnimationFrame(scroll)
    }
    stateRef.current = { container, step, frame: requestAnimationFrame(scroll) }
  }

  return { update, stop }
}

function intersect(
  rect: DOMRect,
  clip: { left: number; right: number; top: number; bottom: number },
): Box {
  const left = Math.max(rect.left, clip.left)
  const top = Math.max(rect.top, clip.top)
  const width = Math.max(Math.min(rect.right, clip.right) - left, 0)
  const height = Math.max(Math.min(rect.bottom, clip.bottom) - top, 0)
  return { left, top, width, height }
}
