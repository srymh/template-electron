import type { Column } from '@tanstack/react-table'
import { XIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { NativeSelect, NativeSelectOption } from '@repo/ui/components/native-select'

import { getColumnLabel } from '../column-label'
import type { DataTableContexts } from '../contexts'
import { getTableMeta } from '../features'
import type { ComponentRowData, DataTableFeatures } from '../features'
import {
  DateRangeFilter,
  NumberRangeFilter,
  TextFilter,
  UnexpectedFilterValue,
} from './filter-inputs'
import { useDraftCommit } from './use-draft-commit'

/**
 * factoryのコンテキストへ、ColumnFilterを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createColumnFilters<TMeta extends object>(contexts: DataTableContexts<TMeta>) {
  const { useTableContext } = contexts

  /** 列フィルターの文字列・数値の入力を反映するまでの待機時間（ms）。 */
  const columnFilterDebounceMs = 500

  // 入力補完の候補の上限。候補が多い列でも datalist の描画を抑える
  const maxTextSuggestions = 5000

  type FilterableColumn = Column<DataTableFeatures<TMeta>, ComponentRowData>

  /** 選択欄の候補にできる値。 */
  type SelectableValue = string | number | boolean

  /**
   * 列の `meta.filterVariant` に応じた列フィルターを、候補（ファセット）の値とともに表示する。
   *
   * @remarks
   * column の参照だけではフィルター値や候補の変更を検知できない。他の列の条件やデータの
   * 差し替えでも候補や値の範囲が変わるため、テーブルの状態を購読し、
   * 現在のフィルター値・入力欄に表示する値（反映を待っている下書きを含む）・候補・値の範囲を
   * 入力欄へ渡す。候補は常に現在のデータから作る。
   * データの差し替えは状態を変えないため、コンテキストのテーブルの `options.data` を
   * スナップショットに含めて読み直しの契機にする（コンテキストのテーブルはデータの差し替えでも
   * 作り直されるため、React Compiler でメモ化された場合も購読の selector を作り直す）。
   */
  function ColumnFilter({ column }: { column: FilterableColumn }) {
    const table = useTableContext()
    const { idPrefix } = getTableMeta(table)
    const { data } = table.options

    return (
      <table.Subscribe selector={() => getFilterSnapshot(column, data)}>
        {({ value, inputValue, min, max, uniqueValues }) => (
          <ColumnFilterInput
            column={column}
            idPrefix={idPrefix}
            value={value}
            inputValue={inputValue}
            min={min}
            max={max}
            uniqueValues={uniqueValues}
          />
        )}
      </table.Subscribe>
    )
  }

  /**
   * 1列の列フィルターの条件をクリアするボタン。
   *
   * @remarks
   * `column.clearFilter()` で、その列の反映を待っている入力を捨ててから値を `undefined` にする
   * （範囲は両端とも消す）。初期状態には戻さない。確定した値がなく入力の反映を待っているだけの
   * 場合も、その入力を捨てる。他の列の条件・入力と一覧検索は変えない。入力欄は解除の世代が
   * 変わることで作り直される。
   */
  function ColumnFilterClearButton({ column }: { column: FilterableColumn }) {
    const label = getColumnLabel(column)

    return (
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`${label}のフィルターをクリア`}
        title={`${label}のフィルターをクリア`}
        className="shrink-0"
        onClick={() => column.clearFilter()}
      >
        <XIcon />
      </Button>
    )
  }

  /**
   * 列フィルターの描画に使う値を読み取る。
   *
   * @param column - 対象の列
   * @param data - テーブルのデータ。差し替えで候補が変わったことを検知するために含める
   * @returns 現在のフィルター値・入力欄に表示する値と、variant が使う候補・範囲
   */
  function getFilterSnapshot(column: FilterableColumn, data: unknown) {
    const filterVariant = column.columnDef.meta?.filterVariant
    const [min, max] = (filterVariant === 'number-range' && column.getFacetedMinMaxValues()) || []
    // 範囲・日付の入力では候補を使わないため、一意な値と件数は取得しない
    const usesUniqueValues =
      filterVariant === 'number-equals' ||
      filterVariant === 'text' ||
      filterVariant === 'select' ||
      filterVariant === 'boolean'
    return {
      value: column.getFilterValue(),
      inputValue: column.getFilterInputValue(),
      min,
      max,
      uniqueValues: usesUniqueValues ? column.getFacetedUniqueValues() : undefined,
      data,
    }
  }

  /**
   * variant ごとの列フィルターの入力欄。
   *
   * @remarks
   * 選択欄では、他の列のフィルターで候補から消えた現在の選択値も件数0で表示し、
   * 解除できるようにする。現在値が選択欄の値として解釈できない場合は、
   * 入力欄の代わりに想定外の値であることを表示する。
   * 文字列・数値の入力は下書きにして {@link columnFilterDebounceMs} 待ってから反映し、
   * 入力欄には `inputValue`（下書きがあればその値）を表示する。
   */
  function ColumnFilterInput({
    column,
    idPrefix,
    value,
    inputValue,
    min,
    max,
    uniqueValues,
  }: {
    column: FilterableColumn
    idPrefix: string
    value: unknown
    inputValue: unknown
    min: number | undefined
    max: number | undefined
    uniqueValues: Map<unknown, number> | undefined
  }) {
    const filterVariant = column.columnDef.meta?.filterVariant
    const label = getColumnLabel(column)
    const counts = uniqueValues ?? new Map<unknown, number>()

    switch (filterVariant) {
      case 'number-range':
        return <NumberRangeColumnFilter column={column} value={inputValue} min={min} max={max} />
      case 'text':
        return (
          <TextColumnFilter
            column={column}
            label={label}
            listId={`${idPrefix}-${column.id}-suggestions`}
            value={inputValue}
            suggestions={Array.from(counts.keys())
              .filter((key) => key !== null && key !== undefined && key !== '')
              .map(String)
              .sort()
              .slice(0, maxTextSuggestions)}
          />
        )
      case 'date-range':
        return (
          <DateRangeFilter
            label={label}
            value={value}
            onChangeValue={(updater) => column.setFilterValue(updater)}
          />
        )
      case 'number-equals': {
        if (!(value === undefined || (typeof value === 'number' && Number.isFinite(value)))) {
          return <UnexpectedFilterValue />
        }
        const options = withSelectedValue(
          Array.from(counts.entries()).filter(
            (entry): entry is [number, number] => typeof entry[0] === 'number',
          ),
          value,
        ).sort(([a], [b]) => a - b)
        return (
          <ValueSelect
            label={label}
            value={value}
            options={options}
            onChangeValue={(next) => column.setFilterValue(next)}
          />
        )
      }
      case 'select': {
        if (!(value === undefined || isSelectableValue(value))) return <UnexpectedFilterValue />
        const options = withSelectedValue(
          Array.from(counts.entries()).filter((entry): entry is [SelectableValue, number] =>
            isSelectableValue(entry[0]),
          ),
          value,
        ).sort(([a], [b]) => String(a).localeCompare(String(b)))
        return (
          <ValueSelect
            label={label}
            value={value}
            options={options}
            onChangeValue={(next) => column.setFilterValue(next)}
          />
        )
      }
      case 'boolean': {
        if (!(value === undefined || typeof value === 'boolean')) return <UnexpectedFilterValue />
        // 件数が0でも、両方の値を常に選べるようにする
        const options: Array<[boolean, number]> = [
          [true, counts.get(true) ?? 0],
          [false, counts.get(false) ?? 0],
        ]
        return (
          <ValueSelect
            label={label}
            value={value}
            options={options}
            onChangeValue={(next) => column.setFilterValue(next)}
          />
        )
      }
      default:
        return null
    }
  }

  /**
   * 文字列の列フィルター。入力を下書きにし、{@link columnFilterDebounceMs} 待ってから反映する。
   *
   * @remarks
   * 空の入力は `undefined` として反映し、フィルターを解除する。アンマウント時（列フィルターを
   * 隠したときなど）は待機中の入力を捨てる。
   */
  function TextColumnFilter({
    column,
    label,
    listId,
    value,
    suggestions,
  }: {
    column: FilterableColumn
    label: string
    listId: string
    value: unknown
    suggestions: string[]
  }) {
    const writeText = useDraftCommit({
      write: (updater) => column.setFilterDraft(updater),
      commit: () => column.commitFilterDraft((text) => text || undefined),
      discard: () => column.discardFilterDraft(),
      wait: columnFilterDebounceMs,
      onUnmount: 'discard',
    })

    return (
      <TextFilter
        label={label}
        listId={listId}
        value={value}
        suggestions={suggestions}
        onChangeValue={writeText}
      />
    )
  }

  /**
   * 数値範囲の列フィルター。範囲の両端の入力を下書きに重ね、{@link columnFilterDebounceMs} 待ってから
   * まとめて反映する。
   *
   * @remarks
   * 両端の更新は下書きに順に重ねるため、待機中に両端を続けて変えても、どちらの変更も失わない。
   * アンマウント時は待機中の入力をすぐに反映する。
   */
  function NumberRangeColumnFilter({
    column,
    value,
    min,
    max,
  }: {
    column: FilterableColumn
    value: unknown
    min: number | undefined
    max: number | undefined
  }) {
    const writeRange = useDraftCommit({
      write: (updater) => column.setFilterDraft(updater),
      commit: () => column.commitFilterDraft(),
      discard: () => column.discardFilterDraft(),
      wait: columnFilterDebounceMs,
      onUnmount: 'flush',
    })

    return (
      <NumberRangeFilter
        label={getColumnLabel(column)}
        value={value}
        onChangeValue={writeRange}
        min={min}
        max={max}
      />
    )
  }

  /**
   * 候補の値と件数から一つを選ぶ選択欄。「すべて」を選ぶと `undefined` を渡して解除する。
   *
   * @remarks
   * option の値は文字列になるため、候補の元の値（数値・真偽値を含む）と一対一に対応する識別子を
   * {@link getOptionId} で作り、選ばれた識別子から元の値を渡す。数値の `1` と文字列の `"1"` のように
   * 表示が同じになる候補には、型の名前を添えて区別する。
   */
  function ValueSelect<T extends SelectableValue>({
    label,
    value,
    options,
    onChangeValue,
  }: {
    label: string
    value: T | undefined
    options: Array<[T, number]>
    onChangeValue: (value: T | undefined) => void
  }) {
    // 表示が同じになる候補を数え、型の名前を添えるかを決める
    const labelCounts = new Map<string, number>()
    for (const [option] of options) {
      labelCounts.set(String(option), (labelCounts.get(String(option)) ?? 0) + 1)
    }

    return (
      <NativeSelect
        size="sm"
        aria-label={`${label}で絞り込む`}
        className="w-full min-w-0"
        value={value === undefined ? '' : getOptionId(value)}
        onChange={(event) =>
          onChangeValue(options.find(([option]) => getOptionId(option) === event.target.value)?.[0])
        }
      >
        <NativeSelectOption value="">すべて</NativeSelectOption>
        {options.map(([option, count]) => {
          const typeLabel =
            (labelCounts.get(String(option)) ?? 0) > 1
              ? `（${valueTypeLabels[typeof option]}）`
              : ''
          return (
            <NativeSelectOption key={getOptionId(option)} value={getOptionId(option)}>
              {`${String(option)}${typeLabel} (${count})`}
            </NativeSelectOption>
          )
        })}
      </NativeSelect>
    )
  }

  const valueTypeLabels: Record<string, string> = {
    string: '文字列',
    number: '数値',
    boolean: '真偽値',
  }

  /**
   * 選択欄の候補の値を、option の値に使う識別子にする。
   *
   * @remarks
   * 文字列はそのまま使い、文字列以外は `\0` と型の名前を前に付ける。`\0` で始まる文字列にも
   * 型の名前を付けるため、異なる値（型が違えば同じ文字列表現の値も）が同じ識別子にならない。
   * 空文字は「すべて」と重ならないよう型の名前を付ける。
   *
   * @param value - 候補の値
   * @returns 値と一対一に対応する識別子
   */
  function getOptionId(value: SelectableValue) {
    if (typeof value === 'string' && value !== '' && !value.startsWith('\0')) return value
    return `\0${typeof value}:${String(value)}`
  }

  function isSelectableValue(value: unknown): value is SelectableValue {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
  }

  /**
   * 候補に、候補から消えた現在の選択値を件数0で加える。
   *
   * @remarks
   * 他の列のフィルターで現在の選択値に該当する行がなくなっても、
   * 選択中の値を表示し、解除できるようにする。
   *
   * @param suggestions - 候補の値と件数の組
   * @param selected - 現在の選択値。`undefined` なら候補をそのまま返す
   * @returns 選択値が候補にあれば `suggestions` 自身、なければ末尾に `[selected, 0]` を加えた新しい配列
   */
  function withSelectedValue<T>(suggestions: Array<[T, number]>, selected: T | undefined) {
    if (selected === undefined || suggestions.some(([value]) => value === selected)) {
      return suggestions
    }
    return [...suggestions, [selected, 0] as [T, number]]
  }

  return { ColumnFilter, ColumnFilterClearButton }
}
