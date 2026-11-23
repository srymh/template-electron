import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import type { RowData } from '@tanstack/react-table'

import type { DataTableCoreTable } from '../features'

/**
 * 上端・下端に固定した行ごとの、固定表示の位置（`top`・`bottom` の px）。
 *
 * @remarks
 * 固定表示（`position: sticky`）は CSS に任せ、見出しと固定行の高さを `ResizeObserver` で
 * 実測して、各行の位置を前の行までの高さの合計として求める。行の高さが内容で変わっても追従する。
 *
 * 描画の後に測るため、初回の描画直後は位置が未確定の瞬間がある。監視する行が増えるほど
 * 計測と状態の更新の負荷が増えるため、固定行は上下合わせて10〜20行程度を目安にする。
 * 行 ID が安定していること、固定行を DOM から外さない（仮想スクロールでも描画し続ける）こと、
 * 固定行の高さが頻繁に変わらない（高さのアニメーションや非同期に読み込む内容を持たない）ことを前提にする。
 * 1行の高さは120px程度まで、見出しは100px程度までを目安にする。
 */
export type PinnedRowOffsets = {
  top: Record<string, number>
  bottom: Record<string, number>
}

/**
 * 固定行の固定表示の位置を計測する。
 *
 * @remarks
 * `ResizeObserver` はフックのマウント中に1つだけ作る。
 * `tableHeadRef` と `getPinnedRowRef` が返す ref callback は、要素の追加・削除に
 * 合わせて監視対象を追加・解除する。そのため同じ行 ID でも要素が入れ替われば
 * 新しい要素を監視し、監視開始時の通知で再計測する。固定行の ID の並びが変わったときも再計測する。
 * 固定行に関係しない描画では監視を登録し直さない。
 *
 * @param table - 固定行を読むテーブル。描画のたびに上端・下端の行 ID を読む
 * @returns `pinnedRowOffsets` は行 ID ごとの位置（px）。
 *   `tableHeadRef` は `thead` に、`getPinnedRowRef(rowId)` は固定行の
 *   `tr` に渡す。同じ行 ID には同じ関数を返す。
 */
export function usePinnedRowOffsets<TData extends RowData, TMeta extends object>(
  table: DataTableCoreTable<TData, TMeta>,
) {
  const [pinnedRowOffsets, setPinnedRowOffsets] = useState<PinnedRowOffsets>({
    top: {},
    bottom: {},
  })

  const tableHeadNode = useRef<HTMLTableSectionElement | null>(null)
  const pinnedRowNodes = useRef(new Map<string, HTMLTableRowElement>())
  const pinnedRowRefCallbacks = useRef(
    new Map<string, (node: HTMLTableRowElement | null) => void>(),
  )
  const observerRef = useRef<ResizeObserver | null>(null)
  const pinnedRowIdsRef = useRef<{ top: string[]; bottom: string[] }>({ top: [], bottom: [] })

  const topRowIds = table.getTopRows().map((row) => row.id)
  const bottomRowIds = table.getBottomRows().map((row) => row.id)
  // 配列は毎回新しく作られるため、Effect の依存には並びを表す文字列を使う
  const topRowIdsKey = JSON.stringify(topRowIds)
  const bottomRowIdsKey = JSON.stringify(bottomRowIds)

  const measurePinnedOffsets = useCallback(() => {
    const { top, bottom } = pinnedRowIdsRef.current
    const nextOffsets: PinnedRowOffsets = {
      top: {},
      bottom: {},
    }

    let topOffset = tableHeadNode.current?.getBoundingClientRect().height ?? 0

    for (const rowId of top) {
      nextOffsets.top[rowId] = topOffset
      topOffset += pinnedRowNodes.current.get(rowId)?.getBoundingClientRect().height ?? 0
    }

    let bottomOffset = 0

    for (let index = bottom.length - 1; index >= 0; index--) {
      const rowId = bottom[index]

      nextOffsets.bottom[rowId] = bottomOffset
      bottomOffset += pinnedRowNodes.current.get(rowId)?.getBoundingClientRect().height ?? 0
    }

    setPinnedRowOffsets((prevOffsets) =>
      areOffsetsEqual(prevOffsets, nextOffsets) ? prevOffsets : nextOffsets,
    )
  }, [])

  // 要素を差し替える。監視開始時の通知で再計測される
  const replaceObservedNode = useCallback(
    (prev: Element | null | undefined, next: Element | null) => {
      if (prev === next) return
      if (prev) observerRef.current?.unobserve(prev)
      if (next) observerRef.current?.observe(next)
    },
    [],
  )

  const tableHeadRef = useCallback(
    (node: HTMLTableSectionElement | null) => {
      replaceObservedNode(tableHeadNode.current, node)
      tableHeadNode.current = node
    },
    [replaceObservedNode],
  )

  const getPinnedRowRef = useCallback(
    (rowId: string) => {
      let refCallback = pinnedRowRefCallbacks.current.get(rowId)
      if (!refCallback) {
        refCallback = (node: HTMLTableRowElement | null) => {
          replaceObservedNode(pinnedRowNodes.current.get(rowId), node)
          if (node) {
            pinnedRowNodes.current.set(rowId, node)
          } else {
            pinnedRowNodes.current.delete(rowId)
          }
        }
        pinnedRowRefCallbacks.current.set(rowId, refCallback)
      }
      return refCallback
    },
    [replaceObservedNode],
  )

  // ref callback は子の commit 時に先に呼ばれるため、
  // 作成時点で接続済みの要素を監視に加える
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver(measurePinnedOffsets)
    observerRef.current = resizeObserver

    if (tableHeadNode.current) {
      resizeObserver.observe(tableHeadNode.current)
    }
    for (const node of pinnedRowNodes.current.values()) {
      resizeObserver.observe(node)
    }

    return () => {
      resizeObserver.disconnect()
      observerRef.current = null
    }
  }, [measurePinnedOffsets])

  useLayoutEffect(() => {
    pinnedRowIdsRef.current = {
      top: JSON.parse(topRowIdsKey) as string[],
      bottom: JSON.parse(bottomRowIdsKey) as string[],
    }
    // 固定行の DOM の高さは描画後にしか測れないため、計測した位置を描画後に反映する
    // oxlint-disable-next-line react/set-state-in-effect -- DOM の計測結果との同期
    measurePinnedOffsets()
  }, [topRowIdsKey, bottomRowIdsKey, measurePinnedOffsets])

  return { pinnedRowOffsets, tableHeadRef, getPinnedRowRef }
}

function areOffsetsEqual(a: PinnedRowOffsets, b: PinnedRowOffsets) {
  return areOffsetRecordsEqual(a.top, b.top) && areOffsetRecordsEqual(a.bottom, b.bottom)
}

function areOffsetRecordsEqual(a: Record<string, number>, b: Record<string, number>) {
  const aKeys = Object.keys(a)

  if (aKeys.length !== Object.keys(b).length) {
    return false
  }

  return aKeys.every((key) => a[key] === b[key])
}
