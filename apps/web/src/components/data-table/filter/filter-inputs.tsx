import { useState } from 'react'

import { Input } from '@repo/ui/components/input'

import { parseDateRange, parseNumberRange } from './filter-fns'
import type { DateRange, NumberRange, Updater } from './filter-fns'

/** 列フィルターの入力欄に共通の、高さと文字を抑えたクラス。 */
const filterInputClassName = 'h-6 min-w-0 px-1.5 text-[11px] md:text-[11px]'

/** 想定外のフィルター値を受け取った場合に、入力欄の代わりに示す表示。 */
export function UnexpectedFilterValue() {
  return <div className="text-destructive text-[11px]">⚠️想定外の値です</div>
}

/**
 * 型の保証がないフィルター値を受け取る数値範囲フィルター。
 *
 * @remarks
 * 値が {@link parseNumberRange} で解釈できない場合は入力欄を表示せず、
 * 想定外の値であることを表示する。片側を変更するときに既存の値が解釈できなければ、
 * もう一方の端は未設定として扱う。両端が未設定になった場合は `undefined` を渡し、
 * フィルターを解除する。`min`・`max` には候補の最小値・最大値を渡し、
 * 入力欄の案内に示すとともに、入力の確定時（blur・Enter）の補正に使う。
 * `label` は入力欄の名前に使う。
 */
export function NumberRangeFilter({
  label,
  value,
  onChangeValue,
  min: limitedMin,
  max: limitedMax,
}: {
  label: string
  value: unknown
  onChangeValue: (updater: Updater<unknown>) => void
  min?: number
  max?: number
}) {
  const range = parseNumberRange(value)
  if (range === null) return <UnexpectedFilterValue />

  const updateRange = (update: (old: NumberRange) => NumberRange) => {
    onChangeValue((old: unknown) => {
      const next = update(parseNumberRange(old) ?? [undefined, undefined])
      return next[0] === undefined && next[1] === undefined ? undefined : next
    })
  }
  const clamp = (input: number) => {
    if (limitedMin !== undefined && input < limitedMin) return limitedMin
    if (limitedMax !== undefined && input > limitedMax) return limitedMax
    return input
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      <NumberInput
        label={`${label}の最小値`}
        placeholder={limitedMin === undefined ? 'Min' : `Min (${limitedMin})`}
        value={range?.[0]}
        filterValue={value}
        onChangeValue={(newMin) => updateRange(([, max]) => [newMin, max])}
        clamp={clamp}
      />
      <NumberInput
        label={`${label}の最大値`}
        placeholder={limitedMax === undefined ? 'Max' : `Max (${limitedMax})`}
        value={range?.[1]}
        filterValue={value}
        onChangeValue={(newMax) => updateRange(([min]) => [min, newMax])}
        clamp={clamp}
      />
    </div>
  )
}

/**
 * 数値範囲の片側の入力欄。
 *
 * @remarks
 * 入力中は編集途中の文字列を保持し、解釈できた数値をそのまま `onChangeValue` へ渡す。
 * `clamp` による補正は、blur または Enter で入力を確定したときだけ行う。
 * 入力欄を空にすると `undefined` を渡す。親から渡す `value` か、範囲全体の `filterValue` が
 * 変わったとき、編集中の値と異なれば親の値で入力欄を置き換える。範囲全体も比べるため、
 * 片側の値が変わらない外からの解除でも、反映を待っている入力を残さない。
 */
function NumberInput({
  label,
  placeholder,
  value,
  filterValue,
  onChangeValue,
  clamp,
}: {
  label: string
  placeholder: string
  value: number | undefined
  filterValue: unknown
  onChangeValue: (value: number | undefined) => void
  clamp: (value: number) => number
}) {
  const [draft, setDraft] = useState(formatNumber(value))
  const [prev, setPrev] = useState({ value, filterValue })

  // 親の値が変わったとき、編集中の文字列が表す数値と異なる場合だけ入力欄を置き換える。
  // 同じ数値なら "05" のような編集途中の表記を維持する。
  if (value !== prev.value || !Object.is(filterValue, prev.filterValue)) {
    setPrev({ value, filterValue })
    if (parseNumber(draft) !== value) setDraft(formatNumber(value))
  }

  const commit = () => {
    const parsed = parseNumber(draft)
    const committed = parsed === undefined ? undefined : clamp(parsed)
    setDraft(formatNumber(committed))
    if (committed !== parsed) onChangeValue(committed)
  }

  return (
    <Input
      type="number"
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value)
        onChangeValue(parseNumber(event.target.value))
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
      }}
      className={`${filterInputClassName} flex-1`}
    />
  )
}

function parseNumber(text: string) {
  if (text.trim() === '') return undefined
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

function formatNumber(value: number | undefined) {
  return value === undefined ? '' : String(value)
}

/**
 * 型の保証がないフィルター値を受け取る文字列フィルター。
 *
 * @remarks
 * 値が未設定でも文字列でもない場合は、想定外の値であることを表示する。
 * 入力のたびに文字列を `onChangeValue` へ渡す（反映の待機は呼び出し側が持つ）。
 * `suggestions` は入力補完の候補に出し、件数を入力欄の案内に示す。
 * `listId` は入力補完の `datalist` の id で、同じ文書内で一意にする。
 */
export function TextFilter({
  label,
  listId,
  value,
  suggestions,
  onChangeValue,
}: {
  label: string
  listId: string
  value: unknown
  suggestions: string[]
  onChangeValue: (value: string) => void
}) {
  if (!(value === undefined || typeof value === 'string')) return <UnexpectedFilterValue />

  return (
    <div className="flex w-full min-w-0 items-center">
      <datalist id={listId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      <Input
        type="text"
        aria-label={`${label}を含む`}
        placeholder={`検索... (${suggestions.length})`}
        list={listId}
        value={value ?? ''}
        onChange={(event) => onChangeValue(event.target.value)}
        className={`${filterInputClassName} w-full`}
      />
    </div>
  )
}

/**
 * 型の保証がないフィルター値を受け取る、開始日・終了日の2つの入力欄を持つ日付範囲フィルター。
 *
 * @remarks
 * 値が {@link parseDateRange} で解釈できない場合は、想定外の値であることを表示する。
 * 片側を変更するときに既存の値が解釈できなければ、もう一方の端は未設定として扱う。
 * 両端が未設定になった場合は `undefined` を渡し、フィルターを解除する。
 */
export function DateRangeFilter({
  label,
  value,
  onChangeValue,
}: {
  label: string
  value: unknown
  onChangeValue: (updater: Updater<unknown>) => void
}) {
  const range = parseDateRange(value)
  if (range === null) return <UnexpectedFilterValue />

  const updateRange = (update: (old: DateRange) => DateRange) => {
    onChangeValue((old: unknown) => {
      const next = update(parseDateRange(old) ?? [undefined, undefined])
      return next[0] === undefined && next[1] === undefined ? undefined : next
    })
  }
  // 入力欄を空にすると空文字になるため、未設定として扱う
  const toDate = (text: string) => text || undefined

  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      <Input
        type="date"
        aria-label={`${label}の開始日`}
        value={range?.[0] ?? ''}
        max={range?.[1]}
        onChange={(event) => updateRange(([, to]) => [toDate(event.target.value), to])}
        className={`${filterInputClassName} flex-1`}
      />
      <Input
        type="date"
        aria-label={`${label}の終了日`}
        value={range?.[1] ?? ''}
        min={range?.[0]}
        onChange={(event) => updateRange(([from]) => [from, toDate(event.target.value)])}
        className={`${filterInputClassName} flex-1`}
      />
    </div>
  )
}
