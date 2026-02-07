export type PaginationItem = number | 'ellipsis'

/**
 * ページネーションのアイテムを取得する
 * @returns ページネーションのアイテム配列
 */
export function getPaginationItems({
  pageIndex,
  totalPages,
  siblingCount = 1,
  boundaryCount = 1,
}: {
  /** 0-based */
  pageIndex: number
  totalPages: number
  /** current の左右に表示するページ数 */
  siblingCount?: number
  /** 先頭・末尾に固定表示するページ数 */
  boundaryCount?: number
}): Array<PaginationItem> {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return []

  const clampedPageIndex = Math.min(
    Math.max(Number.isFinite(pageIndex) ? pageIndex : 0, 0),
    totalPages - 1,
  )

  const safeSiblingCount = Math.max(0, siblingCount)
  const safeBoundaryCount = Math.max(0, boundaryCount)

  const tokens: Array<PaginationItem> = []

  // 先頭の境界ページ
  for (let i = 0; i < Math.min(safeBoundaryCount, totalPages); i++) {
    tokens.push(i)
  }

  const startBoundaryEnd = safeBoundaryCount
  const endBoundaryStart = Math.max(totalPages - safeBoundaryCount, 0)

  const siblingsStart = Math.max(
    Math.min(
      clampedPageIndex - safeSiblingCount,
      endBoundaryStart - safeSiblingCount * 2 - 1,
    ),
    startBoundaryEnd,
  )

  const siblingsEnd = Math.min(
    Math.max(
      clampedPageIndex + safeSiblingCount,
      startBoundaryEnd + safeSiblingCount * 2,
    ),
    endBoundaryStart - 1,
  )

  // 左のギャップ
  if (siblingsStart > startBoundaryEnd) {
    tokens.push('ellipsis')
  } else {
    for (let i = startBoundaryEnd; i < siblingsStart; i++) {
      tokens.push(i)
    }
  }

  // 中央（siblings）
  for (let i = siblingsStart; i <= siblingsEnd; i++) {
    tokens.push(i)
  }

  // 右のギャップ
  if (siblingsEnd < endBoundaryStart - 2) {
    tokens.push('ellipsis')
  } else {
    for (let i = siblingsEnd + 1; i < endBoundaryStart; i++) {
      tokens.push(i)
    }
  }

  // 末尾の境界ページ
  for (
    let i = Math.max(endBoundaryStart, safeBoundaryCount);
    i < totalPages;
    i++
  ) {
    tokens.push(i)
  }

  // 重複や連続 ellipsis を除去
  const result: Array<PaginationItem> = []
  const seenPages = new Set<number>()
  for (const t of tokens) {
    if (t === 'ellipsis') {
      if (result[result.length - 1] !== 'ellipsis' && result.length > 0) {
        result.push(t)
      }
      continue
    }

    if (!seenPages.has(t)) {
      result.push(t)
      seenPages.add(t)
    }
  }

  if (result[0] === 'ellipsis') result.shift()
  if (result[result.length - 1] === 'ellipsis') result.pop()

  return result
}
