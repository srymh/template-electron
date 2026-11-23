import { rankItem } from '@tanstack/match-sorter-utils'
import type { RankingInfo } from '@tanstack/match-sorter-utils'
import { constructFilterFn } from '@tanstack/react-table'
import type { FilterFn, RowData, TableFeatures } from '@tanstack/react-table'

/** 新しい値、または現在の値から新しい値を返す関数。 */
export type Updater<T> = T | ((old: T) => T)

/** 数値範囲フィルターの値。各端の `undefined` はその側に制限がないことを表す。 */
export type NumberRange = [number | undefined, number | undefined]

/**
 * 日付範囲フィルターの値。各端は `YYYY-MM-DD` 形式の文字列で、
 * `undefined` はその側に制限がないことを表す。
 */
export type DateRange = [string | undefined, string | undefined]

/**
 * 型の保証がないフィルター値を数値範囲として解釈する。
 *
 * @param value - フィルター状態に保存されている値
 * @returns 未設定なら `undefined`。長さ2の配列で、各要素が有限の数値・
 *   `null`・`undefined` なら、`null` を `undefined` に置き換えた範囲。
 *   それ以外は `null`
 */
export function parseNumberRange(value: unknown): NumberRange | undefined | null {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length !== 2) return null
  const [min, max] = value.map((v: unknown) => (v === null ? undefined : v))
  if (!isOptionalFiniteNumber(min) || !isOptionalFiniteNumber(max)) return null
  return [min, max]
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}

/**
 * 型の保証がないフィルター値を日付範囲として解釈する。
 *
 * @param value - フィルター状態に保存されている値
 * @returns 未設定なら `undefined`。長さ2の配列で、各要素が `YYYY-MM-DD` 形式の
 *   文字列・`null`・`undefined` なら、`null` を `undefined` に置き換えた範囲。
 *   それ以外は `null`
 */
export function parseDateRange(value: unknown): DateRange | undefined | null {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length !== 2) return null
  const [from, to] = value.map((v: unknown) => (v === null ? undefined : v))
  if (!isOptionalDateString(from) || !isOptionalDateString(to)) return null
  return [from, to]
}

function isOptionalDateString(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

/** {@link fuzzyFilter} が行ごとに保存する、あいまい検索の順位情報。 */
export type FuzzyFilterMeta = {
  itemRank?: RankingInfo
}

/** {@link FuzzyFilterMeta} をフィルターのメタ情報として持つテーブル機能。 */
type FuzzyFeatures = TableFeatures & { filterMeta: FuzzyFilterMeta }

/**
 * `@tanstack/match-sorter-utils` の `rankItem` で、セルの値とフィルター値を
 * あいまいに照合するフィルター。一覧検索に使う。
 *
 * @param row - 判定する行
 * @param columnId - 照合する値を `row.getValue` で取得する列の ID
 * @param value - フィルター値。`rankItem` の検索語として使う
 * @param addMeta - 行のフィルターのメタ情報を保存する関数。指定された場合は
 *   順位情報を `itemRank` として保存する
 * @returns 照合に通った場合は `true`（行を残す）
 */
export const fuzzyFilter: FilterFn<FuzzyFeatures, RowData> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta?.({ itemRank })
  return itemRank.passed
}

/**
 * `YYYY-MM-DD` 形式の日付の文字列が、フィルター値の範囲（両端を含む）に
 * 入る行を残すフィルター。
 *
 * @remarks
 * フィルター値は {@link DateRange}。同じ形式の文字列は辞書順が日付順と一致するため、
 * 文字列のまま比較する。範囲として解釈できない値と、両端が未設定の値では
 * フィルターを解除する。JSON から復元した `null` の端は、未設定として扱う。
 */
export const dateRangeFilter = constructFilterFn({
  // 復元した状態は autoRemove を通らないため、比較の前に必ず正規化する。
  // undefined を返すと元の値が使われるため、解釈できない値も制限なしの範囲にする
  resolveFilterValue: (filterValue): DateRange =>
    parseDateRange(filterValue) ?? [undefined, undefined],
  filter: (dataValue, filterValue) => {
    const [from, to] = filterValue as DateRange
    const date = String(dataValue)
    return (from === undefined || from <= date) && (to === undefined || date <= to)
  },
  autoRemove: (filterValue) => {
    const range = parseDateRange(filterValue)
    return !range || (range[0] === undefined && range[1] === undefined)
  },
})
