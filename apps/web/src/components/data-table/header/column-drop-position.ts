import type { ColumnRegion } from '../column-pinning'

/** 列のドラッグに載せるデータ。並べ替えのハンドルが登録し、移動先の表示と確定で読む。 */
export type ColumnDragData = {
  /** 列の表示名。 */
  label: string
  /** 列の固定領域。移動先はこの領域の中に限る。 */
  region: ColumnRegion
  /** 移動前の、固定領域の中の表示中の列での位置。 */
  index: number
}

/**
 * ドラッグのデータが、列の並べ替えのハンドルが載せたものかを判定する。
 * @param data - dnd-kit のドラッグ元のデータ
 * @returns 列の並べ替えのデータなら `true`
 */
export function isColumnDragData(data: unknown): data is ColumnDragData {
  if (typeof data !== 'object' || data === null) return false
  const { label, region, index } = data as Partial<ColumnDragData>
  return (
    typeof label === 'string' &&
    (region === 'start' || region === 'center' || region === 'end') &&
    typeof index === 'number'
  )
}

/** 固定領域の中の、表示中の列の見出しの左右の端（画面上の座標）。表示順に並べる。 */
export type ColumnEdge = { id: string; left: number; right: number }

/** 列のドラッグの移動先。位置は、固定領域の中の表示中の列で数える。 */
export type ColumnDropPosition = {
  /** 移動前の位置。 */
  fromIndex: number
  /** 移動後の位置。ドラッグ中の列を除いた並びに差し込む位置。 */
  toIndex: number
  /** 差し込む位置の境界の x 座標。 */
  boundaryX: number
}

/**
 * ポインターの x 座標から、ドラッグ中の列の移動先を求める。
 *
 * @remarks
 * ドラッグ中の列を除いた各列の中央より右にポインターがあれば、その列の後ろに入れる。
 * 領域の外にポインターがある場合は、近い方の端に入れる。
 *
 * @param columns - 固定領域の中の表示中の列の端。表示順
 * @param sourceId - ドラッグ中の列の ID
 * @param x - ポインターの x 座標
 * @returns 移動先。ドラッグ中の列が `columns` にない、または他の列がない場合は `undefined`
 */
export function getColumnDropPosition(
  columns: readonly ColumnEdge[],
  sourceId: string,
  x: number,
): ColumnDropPosition | undefined {
  const fromIndex = columns.findIndex((column) => column.id === sourceId)
  const others = columns.filter((column) => column.id !== sourceId)
  if (fromIndex < 0 || others.length === 0) return undefined

  const toIndex = others.filter((column) => (column.left + column.right) / 2 < x).length
  const boundaryX = toIndex < others.length ? others[toIndex]!.left : others.at(-1)!.right
  return { fromIndex, toIndex, boundaryX }
}

/**
 * ドラッグ中の列を `toIndex` へ動かすときに、ポインターを置く x 座標を求める。
 * キーボードでの移動を、ポインターでの移動と同じ計算で扱うために使う。
 *
 * @param columns - 固定領域の中の表示中の列の端。表示順
 * @param sourceId - ドラッグ中の列の ID
 * @param toIndex - ドラッグ中の列を除いた並びに差し込む位置
 * @returns `getColumnDropPosition` が `toIndex` を返す x 座標。他の列がない場合は `undefined`
 */
export function getColumnDropPointerX(
  columns: readonly ColumnEdge[],
  sourceId: string,
  toIndex: number,
): number | undefined {
  const others = columns.filter((column) => column.id !== sourceId)
  if (others.length === 0) return undefined

  // 差し込む位置の右隣の列の左端のすぐ右に置くと、その列の中央より左になる
  const index = Math.min(Math.max(toIndex, 0), others.length)
  return index < others.length ? others[index]!.left + 1 : others.at(-1)!.right - 1
}

/**
 * 見出しの行から、固定領域の中の表示中の列の端を読む。
 *
 * @param headerRow - ドラッグ中の列の見出しがある `tr` 要素
 * @param region - 読む固定領域
 * @returns 表示順の列の端。見出しのセルの `data-column-id`・`data-column-region` から読む
 */
export function readColumnEdges(headerRow: Element, region: ColumnRegion): ColumnEdge[] {
  return [...headerRow.querySelectorAll<HTMLElement>(`th[data-column-region="${region}"]`)].map(
    (cell) => {
      const { left, right } = cell.getBoundingClientRect()
      return { id: cell.dataset.columnId!, left, right }
    },
  )
}
