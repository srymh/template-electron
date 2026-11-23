/** 先頭側に固定した列のうち、最後の列の右に付ける影。 */
export const startPinnedColumnShadowClassName =
  'pointer-events-none absolute top-0 -right-3 h-full w-3 bg-linear-to-r from-foreground/10 to-transparent'

/** 末尾側に固定した列のうち、最初の列の左に付ける影。 */
export const endPinnedColumnShadowClassName =
  'pointer-events-none absolute top-0 -left-3 h-full w-3 bg-linear-to-l from-foreground/10 to-transparent'

/** 列が占める固定位置による領域。列のドラッグはこの領域の中だけで並べ替える。 */
export type ColumnRegion = 'start' | 'center' | 'end'
