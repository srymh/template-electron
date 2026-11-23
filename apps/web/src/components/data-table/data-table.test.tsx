import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { allCapabilities } from './capabilities'
import { DataTable, DataTableView } from './data-table'
import { createDataTableColumnHelper, useDataTable } from './use-data-table'

type Item = { id: string; name: string; kind: string; level: number | null }

const column = createDataTableColumnHelper<Item>()
const columns = [
  column.accessor('name', {
    header: '名前',
    filterFn: 'includesString',
    meta: { filterVariant: 'text' },
  }),
  column.accessor('kind', {
    header: '種類',
    filterFn: 'equalsString',
    meta: { filterVariant: 'select' },
  }),
  column.accessor('level', {
    header: 'レベル',
    filterFn: 'inNumberRange',
    meta: { filterVariant: 'number-range' },
  }),
]
const items: Item[] = [
  { id: 'a', name: 'あか', kind: '炎', level: null },
  { id: 'b', name: 'あお', kind: '水', level: 0 },
  { id: 'c', name: 'みどり', kind: '草', level: 12 },
  { id: 'd', name: 'きいろ', kind: '炎', level: 30 },
]

// 一覧の操作を検証するため、行選択・行固定・セル選択など列や操作を増やす能力は有効にしない
const listCapabilities = {
  sorting: true,
  columnFiltering: true,
  globalFiltering: true,
  pagination: true,
  columnVisibility: true,
}

/** 本文の各行の先頭セルの文字列。 */
function firstCells() {
  const [, body] = screen.getAllByRole('rowgroup')
  return within(body!)
    .queryAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0]!.textContent)
}

/** 本文の行・列の位置のセル。固定行を含め、表示順で数える。 */
function bodyCellAt(rowIndex: number, columnIndex: number) {
  const [, body] = screen.getAllByRole('rowgroup')
  return within(within(body!).getAllByRole('row')[rowIndex]!).getAllByRole('cell')[columnIndex]!
}

/**
 * 見出しのセルの表示名と、列幅の状態から決まる幅。表示順に並べる。
 * 列幅を固定する表の列幅は、最初の行である見出しのセルの幅で決まる。
 */
function headerWidthsOf(label: string) {
  return within(screen.getByRole('table', { name: label }))
    .getAllByRole('columnheader')
    .map((header) => [header.textContent, cellSizeOf(header)])
}

/** セル選択の境界線を、その辺に描画しているか。 */
function hasSelectionEdge(cell: HTMLElement, side: 'top' | 'right' | 'bottom' | 'left') {
  return cell.style.getPropertyValue(`--cell-edge-${side}`) !== '0 0 0 0 transparent'
}

function headerOf(label: string) {
  return screen
    .getAllByRole('columnheader')
    .find((header) => header.textContent?.startsWith(label))!
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('表示だけの表', () => {
  it('能力をすべて外すと操作行を出さず、行順・独自セル・行属性・表の名前を保つ', () => {
    // Arrange
    const displayColumns = [
      column.accessor('name', { header: '名前' }),
      column.display({
        id: 'action',
        header: '',
        cell: ({ row }) => <button type="button">{row.original.name}を開く</button>,
      }),
    ]

    // Act
    render(
      <DataTable
        label="簡易表"
        data={items}
        columns={displayColumns}
        getRowId={(item) => item.id}
        settings={false}
        getRowProps={(row) => ({ className: row.id === 'c' ? 'bg-destructive/5' : undefined })}
      />,
    )
    const table = screen.getByRole('table', { name: '簡易表' })
    const highlighted = within(table)
      .getAllByRole('row')
      .filter((row) => row.classList.contains('bg-destructive/5'))
      .map((row) => within(row).getAllByRole('cell')[0]!.textContent)

    // Assert
    expect(firstCells()).toEqual(['あか', 'あお', 'みどり', 'きいろ'])
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'テーブルの設定' })).toBeNull()
    expect(screen.getByRole('button', { name: 'みどりを開く' })).toBeTruthy()
    expect(highlighted).toEqual(['みどり'])
    expect(within(headerOf('名前')).queryByRole('button')).toBeNull()
  })

  it('指定した能力だけを有効にし、指定しない能力の操作は出さない', () => {
    // Act
    render(<DataTable data={items} columns={columns} capabilities={{ sorting: true }} />)

    // Assert
    expect(within(headerOf('名前')).getByRole('button', { name: '名前' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: '一覧を検索' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'すべての行を選択' })).toBeNull()
  })

  it('allCapabilities を渡すとすべての能力の操作を出す', () => {
    // Act
    render(<DataTable data={items} columns={columns} capabilities={allCapabilities} />)

    // Assert
    expect(within(headerOf('名前')).getByRole('button', { name: '名前' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: '一覧を検索' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'すべての行を選択' })).toBeTruthy()
  })

  it('ページ分割を外すと件数によらず全行を表示する', () => {
    // Arrange
    const rows = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      name: `項目${index}`,
      kind: '',
      level: index,
    }))

    // Act
    render(<DataTable data={rows} columns={columns} />)

    // Assert
    expect(firstCells()).toHaveLength(30)
  })
})

describe('一覧の検索・絞り込み', () => {
  it('一覧検索は200ms待って絞り込み、件数と解除ボタンを表示する', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)

    // Act
    fireEvent.change(screen.getByRole('textbox', { name: '一覧を検索' }), {
      target: { value: 'みどり' },
    })
    act(() => vi.advanceTimersByTime(199))
    const beforeDebounce = firstCells()
    act(() => vi.advanceTimersByTime(1))
    const afterDebounce = firstCells()
    const count = screen.getByText('1 / 4 件').textContent
    fireEvent.click(screen.getByRole('button', { name: '絞り込みを解除' }))
    const afterReset = firstCells()
    const searchValue = screen.getByRole<HTMLInputElement>('textbox', { name: '一覧を検索' }).value

    // Assert
    expect(beforeDebounce).toHaveLength(4)
    expect(afterDebounce).toEqual(['みどり'])
    expect(count).toBe('1 / 4 件')
    expect(afterReset).toHaveLength(4)
    expect(searchValue).toBe('')
    expect(screen.queryByRole('button', { name: '絞り込みを解除' })).toBeNull()
  })

  it('一覧検索は操作行の解除と設定パネルのリセットのどちらで解除しても、同じ行・入力欄・解除ボタンの表示になる', () => {
    // Arrange
    vi.useFakeTimers()
    /** 解除の操作の後の表示。行・検索の入力欄・操作行の解除ボタン・件数の表示を読む。 */
    function readAfterClear() {
      return {
        rows: firstCells(),
        searchValue: screen.getByRole<HTMLInputElement>('textbox', { name: '一覧を検索' }).value,
        hasClearButton: screen.queryByRole('button', { name: '絞り込みを解除' }) !== null,
        hasCount: screen.queryByText(/ \/ 4 件$/) !== null,
      }
    }
    /** 検索語を入力して確定した後、指定の操作で解除する。初期状態の検索語の有無を選ぶ。 */
    function searchAndClear(clearBy: 'toolbar' | 'settings', initialGlobalFilter?: string) {
      render(
        <DataTable
          data={items}
          columns={columns}
          capabilities={listCapabilities}
          initialState={
            initialGlobalFilter === undefined ? undefined : { globalFilter: initialGlobalFilter }
          }
        />,
      )
      fireEvent.change(screen.getByRole('textbox', { name: '一覧を検索' }), {
        target: { value: 'みどり' },
      })
      act(() => vi.advanceTimersByTime(200))
      if (clearBy === 'toolbar') {
        fireEvent.click(screen.getByRole('button', { name: '絞り込みを解除' }))
      } else {
        fireEvent.click(within(openSettings()).getByRole('button', { name: '一覧検索' }))
        fireEvent.keyDown(screen.getByRole('dialog', { name: 'テーブルの設定' }), {
          key: 'Escape',
        })
      }
      const result = readAfterClear()
      cleanup()
      return result
    }

    // Act
    const byToolbar = searchAndClear('toolbar')
    const bySettings = searchAndClear('settings')
    const byToolbarWithInitial = searchAndClear('toolbar', 'あ')
    const bySettingsWithInitial = searchAndClear('settings', 'あ')

    // Assert
    const cleared = {
      rows: ['あか', 'あお', 'みどり', 'きいろ'],
      searchValue: '',
      hasClearButton: false,
      hasCount: false,
    }
    expect(byToolbar).toEqual(cleared)
    expect(bySettings).toEqual(cleared)
    // 初期状態の検索語には戻さず、どちらも検索のない状態にする
    expect(byToolbarWithInitial).toEqual(cleared)
    expect(bySettingsWithInitial).toEqual(cleared)
  })

  it('列フィルターは表示を切り替えるまで見出しに出さない', () => {
    // Arrange
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)

    // Act
    const beforeToggle = within(headerOf('種類')).queryByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const afterToggle = within(headerOf('種類')).queryByRole('combobox')

    // Assert
    expect(beforeToggle).toBeNull()
    expect(afterToggle).toBeTruthy()
  })

  it('選択肢には候補の値と件数を並べ、選んだ値で絞り込む', () => {
    // Arrange
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const kind = within(headerOf('種類')).getByRole<HTMLSelectElement>('combobox')

    // Act
    const options = within(kind)
      .getAllByRole('option')
      .map((option) => option.textContent)
    fireEvent.change(kind, { target: { value: '炎' } })
    const byKind = firstCells()

    // Assert
    expect(options).toEqual(['すべて', '水 (1)', '炎 (2)', '草 (1)'])
    expect(byKind).toEqual(['あか', 'きいろ'])
  })

  it('データを差し替えると、表示中の選択肢の候補も新しいデータで作り直す', () => {
    // Arrange
    const { rerender } = render(
      <DataTable data={items} columns={columns} capabilities={listCapabilities} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))

    // Act
    rerender(
      <DataTable
        data={[...items, { id: 'e', name: 'くろ', kind: '悪', level: 1 }]}
        columns={columns}
        capabilities={listCapabilities}
      />,
    )
    const options = within(within(headerOf('種類')).getByRole('combobox'))
      .getAllByRole('option')
      .map((option) => option.getAttribute('value'))

    // Assert
    expect(options).toEqual(['', '悪', '水', '炎', '草'])
  })

  it('データを差し替えると、入力補完・範囲の案内・数値と真偽の選択肢の件数も新しいデータで作り直す', () => {
    // Arrange
    type Score = { id: string; name: string; level: number; rank: number; active: boolean }
    const scoreColumn = createDataTableColumnHelper<Score>()
    const scoreColumns = [
      scoreColumn.accessor('name', {
        header: '名前',
        filterFn: 'includesString',
        meta: { filterVariant: 'text' },
      }),
      scoreColumn.accessor('level', {
        header: 'レベル',
        filterFn: 'inNumberRange',
        meta: { filterVariant: 'number-range' },
      }),
      scoreColumn.accessor('rank', {
        header: 'ランク',
        filterFn: 'equals',
        meta: { filterVariant: 'number-equals' },
      }),
      scoreColumn.accessor('active', {
        header: '有効',
        filterFn: 'equals',
        meta: { filterVariant: 'boolean' },
      }),
    ]
    const scores: Score[] = [
      { id: 'a', name: 'あか', level: 1, rank: 1, active: true },
      { id: 'b', name: 'あお', level: 5, rank: 2, active: false },
    ]
    const { rerender } = render(
      <DataTable data={scores} columns={scoreColumns} capabilities={listCapabilities} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))

    // Act
    // 行を入れ替え、どの列の候補も変わるデータにする
    rerender(
      <DataTable
        data={[
          { id: 'c', name: 'みどり', level: 3, rank: 2, active: true },
          { id: 'd', name: 'きいろ', level: 9, rank: 4, active: true },
        ]}
        columns={scoreColumns}
        capabilities={listCapabilities}
      />,
    )
    const nameInput = within(headerOf('名前')).getByRole('combobox', { name: '名前を含む' })
    const suggestions = Array.from(
      document.getElementById(nameInput.getAttribute('list')!)!.querySelectorAll('option'),
      (option) => option.value,
    )
    const levelPlaceholders = within(headerOf('レベル'))
      .getAllByRole('spinbutton')
      .map((input) => input.getAttribute('placeholder'))
    const optionLabelsOf = (label: string) =>
      within(within(headerOf(label)).getByRole('combobox'))
        .getAllByRole('option')
        .map((option) => option.textContent)

    // Assert
    expect(suggestions).toEqual(['きいろ', 'みどり'])
    expect(levelPlaceholders).toEqual(['Min (3)', 'Max (9)'])
    expect(optionLabelsOf('ランク')).toEqual(['すべて', '2 (1)', '4 (1)'])
    expect(optionLabelsOf('有効')).toEqual(['すべて', 'true (2)', 'false (0)'])
  })

  it('範囲フィルターは候補の範囲を案内し、両端の入力を待ってからまとめて反映する', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const [min, max] = within(headerOf('レベル')).getAllByRole('spinbutton')

    // Act
    const placeholders = [min!.getAttribute('placeholder'), max!.getAttribute('placeholder')]
    fireEvent.change(min!, { target: { value: '1' } })
    fireEvent.change(max!, { target: { value: '12' } })
    act(() => vi.advanceTimersByTime(499))
    const beforeDebounce = firstCells()
    act(() => vi.advanceTimersByTime(1))
    const afterDebounce = firstCells()

    // Assert
    expect(placeholders).toEqual(['Min (0)', 'Max (30)'])
    expect(beforeDebounce).toHaveLength(4)
    expect(afterDebounce).toEqual(['みどり'])
  })

  it('範囲の入力を待っている間に絞り込みを解除すると、待機中の入力を適用しない', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const [min, max] = within(headerOf('レベル')).getAllByRole('spinbutton')
    fireEvent.change(min!, { target: { value: '1' } })
    act(() => vi.advanceTimersByTime(500))
    const applied = firstCells()

    // Act
    fireEvent.change(max!, { target: { value: '12' } })
    act(() => vi.advanceTimersByTime(200))
    fireEvent.click(screen.getByRole('button', { name: '絞り込みを解除' }))
    act(() => vi.advanceTimersByTime(500))
    const afterClear = firstCells()
    const inputs = within(headerOf('レベル'))
      .getAllByRole<HTMLInputElement>('spinbutton')
      .map((input) => input.value)

    // Assert
    expect(applied).toEqual(['みどり', 'きいろ'])
    expect(afterClear).toEqual(['あか', 'あお', 'みどり', 'きいろ'])
    expect(inputs).toEqual(['', ''])
  })

  it('条件のない範囲に入力して待っている間に全解除すると、値が変わらなくても入力を適用しない', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.change(screen.getByRole('textbox', { name: '一覧を検索' }), {
      target: { value: 'あ' },
    })
    act(() => vi.advanceTimersByTime(200))
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const [min] = within(headerOf('レベル')).getAllByRole('spinbutton')

    // Act
    fireEvent.change(min!, { target: { value: '1' } })
    act(() => vi.advanceTimersByTime(200))
    fireEvent.click(screen.getByRole('button', { name: '絞り込みを解除' }))
    act(() => vi.advanceTimersByTime(500))
    const afterClear = firstCells()
    const inputs = within(headerOf('レベル'))
      .getAllByRole<HTMLInputElement>('spinbutton')
      .map((input) => input.value)

    // Assert
    expect(afterClear).toEqual(['あか', 'あお', 'みどり', 'きいろ'])
    expect(inputs).toEqual(['', ''])
  })

  it('解除の直後に入力し直した範囲は、解除前の待機と分けて適用する', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const spinbuttons = () => within(headerOf('レベル')).getAllByRole('spinbutton')
    fireEvent.change(spinbuttons()[0]!, { target: { value: '1' } })
    act(() => vi.advanceTimersByTime(500))

    // Act
    fireEvent.change(spinbuttons()[1]!, { target: { value: '12' } })
    act(() => vi.advanceTimersByTime(100))
    fireEvent.click(screen.getByRole('button', { name: '絞り込みを解除' }))
    fireEvent.change(spinbuttons()[0]!, { target: { value: '30' } })
    act(() => vi.advanceTimersByTime(500))
    const filtered = firstCells()

    // Assert
    expect(filtered).toEqual(['きいろ'])
  })

  it('待機中に他の操作で範囲が設定された直後の入力は、新しい待機として適用する', () => {
    // Arrange
    vi.useFakeTimers()
    function HostWithPreset() {
      const table = useDataTable({ data: items, columns, capabilities: listCapabilities })
      return (
        <DataTableView
          table={table}
          toolbar={
            <button
              type="button"
              onClick={() => table.getColumn('level')?.setFilterValue([12, 12])}
            >
              12だけ
            </button>
          }
        />
      )
    }
    render(<HostWithPreset />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const spinbuttons = () => within(headerOf('レベル')).getAllByRole('spinbutton')
    fireEvent.change(spinbuttons()[0]!, { target: { value: '1' } })
    act(() => vi.advanceTimersByTime(500))

    // Act
    fireEvent.change(spinbuttons()[1]!, { target: { value: '0' } })
    act(() => vi.advanceTimersByTime(100))
    fireEvent.click(screen.getByRole('button', { name: '12だけ' }))
    fireEvent.change(spinbuttons()[0]!, { target: { value: '30' } })
    act(() => vi.advanceTimersByTime(500))
    const filtered = firstCells()

    // Assert
    expect(filtered).toEqual(['みどり', 'きいろ'])
  })

  it('一覧検索の入力を待っている間に全解除すると、検索語を適用せず入力欄を空にする', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    fireEvent.change(within(headerOf('種類')).getByRole('combobox'), { target: { value: '炎' } })

    // Act
    fireEvent.change(screen.getByRole('textbox', { name: '一覧を検索' }), {
      target: { value: 'あか' },
    })
    act(() => vi.advanceTimersByTime(100))
    fireEvent.click(screen.getByRole('button', { name: '絞り込みを解除' }))
    act(() => vi.advanceTimersByTime(200))
    const afterClear = firstCells()
    const searchValue = screen.getByRole<HTMLInputElement>('textbox', { name: '一覧を検索' }).value

    // Assert
    expect(afterClear).toEqual(['あか', 'あお', 'みどり', 'きいろ'])
    expect(searchValue).toBe('')
  })

  it('選択肢は型が違えば同じ表記の値も区別し、選んだ値だけで絞り込む', () => {
    // Arrange
    type Mixed = { id: string; code: string | number }
    const mixedColumn = createDataTableColumnHelper<Mixed>()
    const mixedColumns = [
      mixedColumn.accessor('id', { header: 'ID' }),
      mixedColumn.accessor('code', {
        header: 'コード',
        filterFn: 'equals',
        meta: { filterVariant: 'select' },
      }),
    ]
    const mixedRows: Mixed[] = [
      { id: 'number', code: 1 },
      { id: 'string', code: '1' },
      { id: 'other', code: 'x' },
    ]
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<DataTable data={mixedRows} columns={mixedColumns} capabilities={listCapabilities} />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const select = within(headerOf('コード')).getByRole<HTMLSelectElement>('combobox')
    const stringOption = within(select).getByRole<HTMLOptionElement>('option', {
      name: '1（文字列） (1)',
    })

    // Act
    const labels = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent)
    fireEvent.change(select, { target: { value: stringOption.value } })
    const filtered = firstCells()
    const selectedLabel = select.selectedOptions[0]?.textContent
    const keyWarnings = consoleError.mock.calls.filter((call) => String(call[0]).includes('key'))
    consoleError.mockRestore()

    // Assert
    expect(labels).toEqual(['すべて', '1（数値） (1)', '1（文字列） (1)', 'x (1)'])
    expect(filtered).toEqual(['string'])
    expect(selectedLabel).toBe('1（文字列） (1)')
    expect(keyWarnings).toEqual([])
  })

  it('文字列フィルターは候補を入力補完に出し、待ってから絞り込む', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const input = within(headerOf('名前')).getByRole('combobox', { name: '名前を含む' })

    // Act
    const placeholder = input.getAttribute('placeholder')
    const suggestions = Array.from(
      document.getElementById(input.getAttribute('list')!)!.querySelectorAll('option'),
      (option) => option.value,
    )
    fireEvent.change(input, { target: { value: 'あ' } })
    act(() => vi.advanceTimersByTime(500))
    const filtered = firstCells()

    // Assert
    expect(placeholder).toBe('検索... (4)')
    expect(suggestions).toEqual(['あお', 'あか', 'きいろ', 'みどり'])
    expect(filtered).toEqual(['あか', 'あお'])
  })

  it('行が0件のときと絞り込みで該当がないときを区別して示す', () => {
    // Arrange
    vi.useFakeTimers()

    // Act
    render(<DataTable data={[]} columns={columns} capabilities={listCapabilities} />)
    const empty = screen.getByText('0件').textContent
    cleanup()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.change(screen.getByRole('textbox', { name: '一覧を検索' }), {
      target: { value: 'zzzz' },
    })
    act(() => vi.advanceTimersByTime(200))
    const noMatch = screen.getByText('該当なし').textContent

    // Assert
    expect(empty).toBe('0件')
    expect(noMatch).toBe('該当なし')
  })
})

describe('一覧の並び替え・ページ・列', () => {
  it('見出しのボタンで並び替え、もう一度押すと逆順にする', () => {
    // Arrange
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    const sortButton = () => within(headerOf('名前')).getByRole('button')

    // Act
    fireEvent.click(sortButton())
    const first = firstCells()
    const ariaSort = headerOf('名前').getAttribute('aria-sort')
    fireEvent.click(sortButton())
    const second = firstCells()

    // Assert
    expect(first).toEqual(['あお', 'あか', 'きいろ', 'みどり'])
    expect(ariaSort).toBe('ascending')
    expect(second).toEqual(['みどり', 'きいろ', 'あか', 'あお'])
  })

  it('ページ送りと件数の選択で全行に到達し、独自の初期件数を選択肢に含める', () => {
    // Arrange
    const rows = Array.from({ length: 25 }, (_, index) => ({
      id: String(index),
      name: `項目${index + 1}`,
      kind: '',
      level: index,
    }))
    render(
      <DataTable
        data={rows}
        columns={columns}
        capabilities={listCapabilities}
        initialState={{ pagination: { pageIndex: 0, pageSize: 7 } }}
        pageSizeOptions={[50, 100]}
      />,
    )
    const pageSize = screen.getByRole<HTMLSelectElement>('combobox', { name: '1ページの件数' })

    // Act
    const visited = [...firstCells()]
    while (!screen.getByRole<HTMLButtonElement>('button', { name: '次のページ' }).disabled) {
      fireEvent.click(screen.getByRole('button', { name: '次のページ' }))
      visited.push(...firstCells())
    }
    const sizes = within(pageSize)
      .getAllByRole('option')
      .map((option) => option.textContent)
    fireEvent.change(pageSize, { target: { value: '50' } })
    const expanded = firstCells()

    // Assert
    expect(visited).toEqual(rows.map((row) => row.name))
    expect(sizes).toEqual(['7', '50', '100'])
    expect(expanded).toHaveLength(25)
  })

  it('最小の件数で1ページに収まる一覧ではページ操作を省く', () => {
    // Arrange・Act
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)

    // Assert
    expect(screen.queryByRole('button', { name: '次のページ' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: '1ページの件数' })).toBeNull()
  })

  it('初期状態で隠した列を数で示す', () => {
    // Arrange・Act
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={listCapabilities}
        initialState={{ columnVisibility: { level: false } }}
      />,
    )
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    const menuText = screen.getByRole('button', { name: '表示する列' }).textContent

    // Assert
    expect(headers).toEqual(['名前', '種類'])
    expect(menuText).toBe('-1')
  })
})

describe('行・列の操作', () => {
  it('行選択の列で全行を選ぶと、各行の選択と見出しのチェックを揃える', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ rowSelection: true }}
        getRowId={(item) => item.id}
      />,
    )

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: 'すべての行を選択' }))
    const rowChecks = ['a', 'b', 'c', 'd'].map(
      (id) => screen.getByRole<HTMLInputElement>('checkbox', { name: `行 ${id} を選択` }).checked,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: '行 b を選択' }))
    const allCheck = screen.getByRole<HTMLInputElement>('checkbox', { name: 'すべての行を選択' })

    // Assert
    expect(rowChecks).toEqual([true, true, true, true])
    expect(allCheck.checked).toBe(false)
    expect(allCheck.indeterminate).toBe(true)
  })

  it('行選択を切り替えると、その行の選択表示だけを切り替える', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ rowSelection: true }}
        getRowId={(item) => item.id}
      />,
    )
    const [, body] = screen.getAllByRole('rowgroup')
    const selectedRows = () =>
      within(body!)
        .getAllByRole('row')
        .map((row) => row.dataset.isSelected === 'true')

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: '行 b を選択' }))
    const afterSelect = selectedRows()
    fireEvent.click(screen.getByRole('checkbox', { name: '行 b を選択' }))
    const afterDeselect = selectedRows()

    // Assert
    expect(afterSelect).toEqual([false, true, false, false])
    expect(afterDeselect).toEqual([false, false, false, false])
  })

  it('列幅を変えると、表示順の見出しの幅と、後ろに並ぶ固定列の位置を更新する', () => {
    // Arrange
    render(
      <DataTable
        label="列幅"
        data={items}
        columns={columns}
        capabilities={{ columnResizing: true, columnPinning: true }}
        initialState={{ columnPinning: { start: ['kind', 'name'], end: [] } }}
        initialLayout={{ showColumnPinningButtons: true }}
      />,
    )
    // 列幅を固定する表（既定）では、幅は見出しのセルにだけ書き、本文のセルには書かない
    const layout = () => ({
      headerWidths: headerWidthsOf('列幅'),
      bodyCellSizes: [0, 1, 2].map((index) =>
        bodyCellAt(0, index).style.getPropertyValue('--cell-size'),
      ),
      starts: [0, 1].map((index) => bodyCellAt(0, index).style.getPropertyValue('--inline-start')),
    })

    // Act
    const initial = layout()
    // 固定列の幅を変えると、後ろの固定列の位置も変わる
    fireEvent.keyDown(screen.getByRole('button', { name: '種類の列幅を変更' }), {
      key: 'ArrowRight',
    })
    const pinnedResized = layout()
    // 固定していない列の幅だけを変えると、固定列の位置は変わらない
    fireEvent.keyDown(screen.getByRole('button', { name: 'レベルの列幅を変更' }), {
      key: 'ArrowRight',
    })
    const unpinnedResized = layout()
    // 列の固定を解除すると、見出しも表示順に並べ直す
    fireEvent.click(screen.getByRole('button', { name: '種類の列の固定を解除' }))
    const unpinned = headerWidthsOf('列幅')

    // Assert
    expect(initial).toEqual({
      headerWidths: [
        ['種類', '150px'],
        ['名前', '150px'],
        ['レベル', '150px'],
      ],
      bodyCellSizes: ['', '', ''],
      starts: ['0px', '150px'],
    })
    expect(pinnedResized).toEqual({
      headerWidths: [
        ['種類', '160px'],
        ['名前', '150px'],
        ['レベル', '150px'],
      ],
      bodyCellSizes: ['', '', ''],
      starts: ['0px', '160px'],
    })
    expect(unpinnedResized).toEqual({
      headerWidths: [
        ['種類', '160px'],
        ['名前', '150px'],
        ['レベル', '160px'],
      ],
      bodyCellSizes: ['', '', ''],
      starts: ['0px', '160px'],
    })
    expect(unpinned).toEqual([
      ['名前', '150px'],
      ['種類', '160px'],
      ['レベル', '160px'],
    ])
  })

  it('列幅を固定しない表では本文のセルに列幅を最小幅として書き、固定に切り替えると本文のセルから外す', () => {
    // Arrange
    render(
      <DataTable
        label="列幅"
        data={items}
        columns={columns}
        capabilities={{ columnResizing: true }}
        initialLayout={{ tableFixed: false }}
      />,
    )
    const firstCellSize = () => bodyCellAt(0, 0).style.getPropertyValue('--cell-size')

    // Act
    const autoInitial = firstCellSize()
    fireEvent.keyDown(screen.getByRole('button', { name: '名前の列幅を変更' }), {
      key: 'ArrowRight',
    })
    const autoResized = firstCellSize()
    const panel = openSettings()
    fireEvent.click(within(panel).getByRole('checkbox', { name: '列幅を固定する' }))
    fireEvent.keyDown(panel, { key: 'Escape' })
    const fixed = { headerWidths: headerWidthsOf('列幅'), cellSize: firstCellSize() }

    // Assert
    expect(autoInitial).toBe('150px')
    expect(autoResized).toBe('160px')
    expect(fixed).toEqual({
      headerWidths: [
        ['名前', '160px'],
        ['種類', '150px'],
        ['レベル', '150px'],
      ],
      cellSize: '',
    })
  })

  it('行選択を切り替えても、チェックボックスのアイコンの要素を差し替えない', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ rowSelection: true }}
        getRowId={(item) => item.id}
      />,
    )
    const iconsOf = (name: string) => [
      ...screen.getByRole('checkbox', { name }).parentElement!.querySelectorAll('svg'),
    ]
    const initialRowIcons = iconsOf('行 b を選択')
    const initialAllIcons = iconsOf('すべての行を選択')

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: '行 b を選択' }))
    const selectedRowIcons = iconsOf('行 b を選択')
    const indeterminateAllIcons = iconsOf('すべての行を選択')
    fireEvent.click(screen.getByRole('checkbox', { name: 'すべての行を選択' }))
    const checkedAllIcons = iconsOf('すべての行を選択')

    // Assert
    expect(initialRowIcons.map((icon) => icon.dataset.icon)).toEqual([
      'unchecked',
      'checked',
      'indeterminate',
    ])
    // toEqual は DOM 要素を構造で比べ、作り直した同じ内容の要素でも通るため、各要素の同一性を比べる
    for (const [icons, initialIcons] of [
      [selectedRowIcons, initialRowIcons],
      [indeterminateAllIcons, initialAllIcons],
      [checkedAllIcons, initialAllIcons],
    ] as const) {
      expect(icons).toHaveLength(initialIcons.length)
      icons.forEach((icon, index) => expect(icon).toBe(initialIcons[index]))
    }
    expect(initialRowIcons.every((icon) => icon.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  it('行を上端に固定すると先頭に表示し、解除すると元の位置へ戻す', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ rowPinning: true }}
        initialLayout={{ showRowPinningColumn: true }}
        getRowId={(item) => item.id}
      />,
    )

    // Act
    fireEvent.click(screen.getByRole('button', { name: '行 c を上端に固定' }))
    const pinned = firstCells()
    const pinnedRow = screen.getAllByRole('row').find((row) => row.dataset.isPinned === 'top')
    fireEvent.click(screen.getByRole('button', { name: '行 c の固定を解除' }))
    const unpinned = firstCells()

    // Assert
    expect(pinned[0]).toBe('みどり')
    expect(within(pinnedRow!).getAllByRole('cell')[0]!.textContent).toBe('みどり')
    expect(unpinned).toEqual(['あか', 'あお', 'みどり', 'きいろ'])
  })

  it('列を先頭に固定すると見出しと本文のセルを固定表示にする', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ columnPinning: true }}
        initialLayout={{ showColumnPinningButtons: true }}
      />,
    )

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'レベルの列を先頭に固定' }))
    const headers = screen.getAllByRole('columnheader')

    // Assert
    expect(headers.map((header) => header.textContent)).toEqual(['レベル', '名前', '種類'])
    expect(headers[0]!.dataset.isPinned).toBe('start')
    expect(screen.getByRole('button', { name: 'レベルの列の固定を解除' })).toBeTruthy()
  })
})

describe('列の並べ替え', () => {
  /** 見出しの行の各セルが持つ、ドラッグの開始点の属性。 */
  function headerCellDragAttributes() {
    const [head] = screen.getAllByRole('rowgroup')
    return [...head!.querySelectorAll('th')].map((th) => ({
      role: th.getAttribute('role'),
      tabIndex: th.getAttribute('tabindex'),
      roleDescription: th.getAttribute('aria-roledescription'),
    }))
  }

  const noDragAttributes = { role: null, tabIndex: null, roleDescription: null }

  // dnd-kit はモジュール全体で1つの描画待ち（requestAnimationFrame）を使い、待っている間は新しく予約しない。
  // 前のテストが実時間で予約した描画待ちが残ると属性の付与が流れないまま検証するため、
  // 偽のタイマーへ切り替える前に1フレーム待ち、残った予約を流す
  beforeEach(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

  it('並べ替えを無効にした表では、描画が進んでも見出しのセルを見出しとして扱う', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={{ sorting: true }} />)

    // Act
    act(() => vi.advanceTimersByTime(100))

    // Assert
    expect(screen.getAllByRole('columnheader')).toHaveLength(columns.length)
    expect(headerCellDragAttributes()).toEqual(columns.map(() => noDragAttributes))
    expect(screen.queryByRole('button', { name: '名前の列を並べ替える' })).toBeNull()
  })

  it('並べ替えを有効にした表では、ドラッグの開始点の属性をハンドルにだけ付ける', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={{ columnOrdering: true }} />)

    // Act
    act(() => vi.advanceTimersByTime(100))
    const handle = screen.getByRole('button', { name: '名前の列を並べ替える' })

    // Assert
    expect(screen.getAllByRole('columnheader')).toHaveLength(columns.length)
    expect(headerCellDragAttributes()).toEqual(columns.map(() => noDragAttributes))
    expect(handle.getAttribute('aria-roledescription')).toBe('draggable')
  })

  it('並べ替えを有効から無効に切り替えると、ハンドルを外し、見出しのセルに属性を付けない', () => {
    // Arrange
    vi.useFakeTimers()
    const { rerender } = render(
      <DataTable data={items} columns={columns} capabilities={{ columnOrdering: true }} />,
    )
    act(() => vi.advanceTimersByTime(100))

    // Act
    rerender(<DataTable data={items} columns={columns} capabilities={{ columnOrdering: false }} />)
    act(() => vi.advanceTimersByTime(100))

    // Assert
    expect(screen.queryByRole('button', { name: '名前の列を並べ替える' })).toBeNull()
    expect(screen.getAllByRole('columnheader')).toHaveLength(columns.length)
    expect(headerCellDragAttributes()).toEqual(columns.map(() => noDragAttributes))
  })

  describe('キーボード', () => {
    /** 見出しの表示名を表示順に並べる。 */
    function headerLabels() {
      return screen.getAllByRole('columnheader').map((header) => header.textContent)
    }

    /** ハンドルにキーを送り、dnd-kit の移動の反映を待つ。 */
    async function pressHandleKey(handle: HTMLElement, key: string) {
      await act(async () => {
        fireEvent.keyDown(handle, { key })
        await Promise.resolve()
      })
    }

    // jsdom は要素の位置を持たないため、見出しのセルを表示順に幅 100 で並べる。
    // dnd-kit が移動のたびに呼ぶ elementFromPoint・scrollIntoView も jsdom にないため補う
    beforeEach(() => {
      document.elementFromPoint ??= () => null
      Element.prototype.scrollIntoView ??= () => {}
      const getRect = Element.prototype.getBoundingClientRect
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        if (this instanceof HTMLTableCellElement && this.dataset.columnId !== undefined) {
          return new DOMRect(this.cellIndex * 100, 0, 100, 30)
        }
        return getRect.call(this)
      })
      return () => vi.restoreAllMocks()
    })

    it('矢印キーで動かしている間は列順を変えず、確定したときに1回だけ移す', async () => {
      // Arrange
      render(<DataTable data={items} columns={columns} capabilities={{ columnOrdering: true }} />)
      const handle = screen.getByRole('button', { name: '名前の列を並べ替える' })
      handle.focus()

      // Act
      await pressHandleKey(handle, ' ')
      await pressHandleKey(handle, 'ArrowRight')
      await pressHandleKey(handle, 'ArrowRight')
      const duringDrag = headerLabels()
      await pressHandleKey(handle, ' ')

      // Assert
      expect(duringDrag).toEqual(['名前', '種類', 'レベル'])
      expect(headerLabels()).toEqual(['種類', 'レベル', '名前'])
    })

    it('Escape で取り消すと列順を変えない', async () => {
      // Arrange
      render(<DataTable data={items} columns={columns} capabilities={{ columnOrdering: true }} />)
      const handle = screen.getByRole('button', { name: '名前の列を並べ替える' })
      handle.focus()

      // Act
      await pressHandleKey(handle, 'Enter')
      await pressHandleKey(handle, 'ArrowRight')
      await pressHandleKey(handle, 'Escape')

      // Assert
      expect(headerLabels()).toEqual(['名前', '種類', 'レベル'])
    })

    it('端を越える矢印キーは端で止め、左へ戻した位置に移す', async () => {
      // Arrange
      render(<DataTable data={items} columns={columns} capabilities={{ columnOrdering: true }} />)
      const handle = screen.getByRole('button', { name: 'レベルの列を並べ替える' })
      handle.focus()

      // Act
      await pressHandleKey(handle, ' ')
      await pressHandleKey(handle, 'ArrowRight')
      await pressHandleKey(handle, 'ArrowLeft')
      await pressHandleKey(handle, ' ')

      // Assert
      // 末尾の列は右へ動かず、左へ1列戻ると種類の前に入る
      expect(headerLabels()).toEqual(['名前', 'レベル', '種類'])
    })

    it('ドラッグ中に並べ替えを無効にすると取り消し、有効に戻すと新しくドラッグできる', async () => {
      // Arrange
      const { rerender } = render(
        <DataTable data={items} columns={columns} capabilities={{ columnOrdering: true }} />,
      )
      const firstHandle = screen.getByRole('button', { name: '名前の列を並べ替える' })
      firstHandle.focus()
      await pressHandleKey(firstHandle, ' ')
      await pressHandleKey(firstHandle, 'ArrowRight')

      // Act
      await act(async () => {
        rerender(
          <DataTable data={items} columns={columns} capabilities={{ columnOrdering: false }} />,
        )
        await Promise.resolve()
      })
      const announcementAfterDisable = screen.queryByText('名前の並べ替えを取り消しました')
      const orderAfterDisable = headerLabels()
      await act(async () => {
        rerender(
          <DataTable data={items} columns={columns} capabilities={{ columnOrdering: true }} />,
        )
        await Promise.resolve()
      })
      const secondHandle = screen.getByRole('button', { name: '名前の列を並べ替える' })
      secondHandle.focus()
      await pressHandleKey(secondHandle, ' ')
      await pressHandleKey(secondHandle, 'ArrowRight')
      await pressHandleKey(secondHandle, 'ArrowRight')
      await pressHandleKey(secondHandle, ' ')

      // Assert
      expect(announcementAfterDisable).not.toBeNull()
      expect(orderAfterDisable).toEqual(['名前', '種類', 'レベル'])
      expect(headerLabels()).toEqual(['種類', 'レベル', '名前'])
    })
  })
})

describe('セル選択とキーボード移動', () => {
  it('Tab の到達先を1つだけ作り、矢印キーで選択を移す', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ cellSelection: true }}
        getRowId={(item) => item.id}
      />,
    )
    const cells = () => screen.getAllByRole('cell')

    // Act
    const tabStops = cells().filter((cell) => cell.tabIndex === 0)
    fireEvent.keyDown(tabStops[0]!, { key: 'ArrowDown' })
    const focused = cells().filter((cell) => cell.dataset.selectedState === 'focused')
    fireEvent.keyDown(focused[0]!, { key: 'ArrowRight', shiftKey: true })
    const selectedTexts = cells()
      .filter((cell) => cell.dataset.selectedState)
      .map((cell) => cell.textContent)

    // Assert
    expect(tabStops.map((cell) => cell.textContent)).toEqual(['あか'])
    expect(focused.map((cell) => cell.textContent)).toEqual(['あお'])
    expect(selectedTexts).toEqual(['あお', '水'])
    expect(screen.getByText('選択 2 セル')).toBeTruthy()
  })

  it('同じ行の中で選択範囲を広げて縮めると、選択するセルと左右の境界線を更新する', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ cellSelection: true }}
        getRowId={(item) => item.id}
      />,
    )
    const selectedInFirstRow = () =>
      [0, 1, 2].map((columnIndex) => Boolean(bodyCellAt(0, columnIndex).dataset.selectedState))

    // Act
    fireEvent.mouseDown(bodyCellAt(0, 0), { button: 0 })
    fireEvent.mouseEnter(bodyCellAt(0, 2))
    const widened = selectedInFirstRow()
    const widenedMiddleRightEdge = hasSelectionEdge(bodyCellAt(0, 1), 'right')
    fireEvent.mouseEnter(bodyCellAt(0, 1))
    const narrowed = selectedInFirstRow()
    const narrowedMiddleRightEdge = hasSelectionEdge(bodyCellAt(0, 1), 'right')
    fireEvent.mouseUp(document)

    // Assert
    expect(widened).toEqual([true, true, true])
    expect(widenedMiddleRightEdge).toBe(false)
    expect(narrowed).toEqual([true, true, false])
    expect(narrowedMiddleRightEdge).toBe(true)
  })

  it('下の行に範囲を加えて除外すると、選択の変わらない上の行の下側の境界線も更新する', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ cellSelection: true }}
        getRowId={(item) => item.id}
      />,
    )
    const upperBottomEdge = () => hasSelectionEdge(bodyCellAt(0, 0), 'bottom')

    // Act
    fireEvent.mouseDown(bodyCellAt(0, 0), { button: 0 })
    fireEvent.mouseUp(document)
    const single = upperBottomEdge()
    fireEvent.mouseDown(bodyCellAt(1, 0), { button: 0, ctrlKey: true })
    fireEvent.mouseUp(document)
    const added = {
      upperBottomEdge: upperBottomEdge(),
      lowerTopEdge: hasSelectionEdge(bodyCellAt(1, 0), 'top'),
    }
    fireEvent.mouseDown(bodyCellAt(1, 0), { button: 0, ctrlKey: true })
    fireEvent.mouseUp(document)
    const excluded = {
      upperBottomEdge: upperBottomEdge(),
      showsOneSelectedCell: screen.queryByText('選択 1 セル') !== null,
    }

    // Assert
    expect(single).toBe(true)
    expect(added).toEqual({ upperBottomEdge: false, lowerTopEdge: false })
    expect(excluded).toEqual({ upperBottomEdge: true, showsOneSelectedCell: true })
  })

  it('列の固定で表示順が変わると、Tab の到達先と矢印キー・Shift による移動を新しい並びで決める', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ cellSelection: true, columnPinning: true }}
        initialLayout={{ showColumnPinningButtons: true }}
        getRowId={(item) => item.id}
      />,
    )
    const tabStopColumns = () =>
      [0, 1, 2].filter((columnIndex) => bodyCellAt(0, columnIndex).tabIndex === 0)
    const cellTexts = (state: 'focused' | 'selected-or-focused') =>
      screen
        .getAllByRole('cell')
        .filter((cell) =>
          state === 'focused'
            ? cell.dataset.selectedState === 'focused'
            : Boolean(cell.dataset.selectedState),
        )
        .map((cell) => cell.textContent)

    // Act
    const initialTabStops = tabStopColumns()
    // レベルの列を先頭へ移し、表示順を レベル・名前・種類 にする
    fireEvent.click(screen.getByRole('button', { name: 'レベルの列を先頭に固定' }))
    const reorderedTabStops = tabStopColumns()
    fireEvent.mouseDown(bodyCellAt(1, 1), { button: 0 })
    fireEvent.mouseUp(document)
    fireEvent.keyDown(bodyCellAt(1, 1), { key: 'ArrowLeft' })
    const movedLeft = cellTexts('focused')
    fireEvent.keyDown(bodyCellAt(1, 0), { key: 'ArrowRight', shiftKey: true })
    const extended = cellTexts('selected-or-focused')

    // Assert
    expect(initialTabStops).toEqual([0])
    expect(reorderedTabStops).toEqual([0])
    expect(bodyCellAt(0, 0).textContent).toBe('')
    expect(movedLeft).toEqual(['0'])
    expect(extended).toEqual(['0', 'あお'])
  })

  it('データを差し替えると、矢印キーによる移動を新しい行の並びで決める', () => {
    // Arrange
    const view = render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ cellSelection: true }}
        getRowId={(item) => item.id}
      />,
    )
    fireEvent.mouseDown(bodyCellAt(0, 0), { button: 0 })
    fireEvent.mouseUp(document)

    // Act
    // 2行目を除いたデータに差し替える。テーブルの状態は変わらない
    view.rerender(
      <DataTable
        data={items.filter((item) => item.id !== 'b')}
        columns={columns}
        capabilities={{ cellSelection: true }}
        getRowId={(item) => item.id}
      />,
    )
    fireEvent.keyDown(bodyCellAt(0, 0), { key: 'ArrowDown' })
    const focused = screen
      .getAllByRole('cell')
      .filter((cell) => cell.dataset.selectedState === 'focused')
      .map((cell) => cell.textContent)

    // Assert
    expect(focused).toEqual(['みどり'])
  })

  it('データや列を差し替えると、Tab の到達先を新しい先頭のセルにする', () => {
    // Arrange
    const tableWith = (data: Item[], tableColumns: typeof columns) => (
      <DataTable
        data={data}
        columns={tableColumns}
        capabilities={{ cellSelection: true }}
        getRowId={(item) => item.id}
      />
    )
    const view = render(tableWith(items, columns))
    const tabStopTexts = () =>
      screen
        .getAllByRole('cell')
        .filter((cell) => cell.tabIndex === 0)
        .map((cell) => cell.textContent)

    // Act
    const initial = tabStopTexts()
    // テーブルの状態は変えず、先頭の行を除いたデータに差し替える
    const dataWithoutFirst = items.filter((item) => item.id !== 'a')
    view.rerender(tableWith(dataWithoutFirst, columns))
    const afterData = tabStopTexts()
    // 列の並びを逆にした列定義に差し替える
    view.rerender(tableWith(dataWithoutFirst, [...columns].reverse()))
    const afterColumns = tabStopTexts()

    // Assert
    expect(initial).toEqual(['あか'])
    expect(afterData).toEqual(['あお'])
    expect(afterColumns).toEqual(['0'])
  })

  it('セル選択を使わない表では、文字列を選択できる通常のセルにする', () => {
    // Arrange・Act
    render(<DataTable data={items} columns={columns} />)
    const cells = screen.getAllByRole('cell')

    // Assert
    expect(cells.every((cell) => !cell.hasAttribute('tabindex'))).toBe(true)
    expect(cells.some((cell) => cell.classList.contains('select-none'))).toBe(false)
  })
})

/** 操作行の列メニューを開き、メニューを返す。 */
function openColumnMenu() {
  fireEvent.click(screen.getByRole('button', { name: '表示する列' }))
  return screen.getByRole('menu')
}

/** 操作行の設定ボタンでパネルを開き、パネルを返す。 */
function openSettings(index = 0) {
  fireEvent.click(screen.getAllByRole('button', { name: 'テーブルの設定' })[index]!)
  return screen.getByRole('dialog', { name: 'テーブルの設定' })
}

/** 列の見出しセルの、列幅の状態から決まる幅。 */
function cellSizeOf(header: HTMLElement) {
  return header.style.getPropertyValue('--cell-size')
}

describe('操作列', () => {
  it('操作列は列メニューから除外し、設定で隠して再表示しても選択と固定を保つ', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{
          rowSelection: true,
          rowPinning: true,
          columnVisibility: true,
        }}
        initialLayout={{ showRowPinningColumn: true }}
        getRowId={(item) => item.id}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: '行 b を選択' }))
    fireEvent.click(screen.getByRole('button', { name: '行 c を上端に固定' }))

    // Act
    const menu = openColumnMenu()
    const menuLabels = within(menu)
      .getAllByRole('menuitemcheckbox')
      .map((item) => item.textContent)
    fireEvent.keyDown(menu, { key: 'Escape' })
    const panel = openSettings()
    fireEvent.click(within(panel).getByRole('checkbox', { name: '行選択列を表示する' }))
    fireEvent.click(within(panel).getByRole('checkbox', { name: '上下への行固定操作列を表示する' }))
    fireEvent.keyDown(panel, { key: 'Escape' })
    const hiddenHeaders = screen.getAllByRole('columnheader').map((header) => header.textContent)
    const hiddenOrder = firstCells()
    const reopened = openSettings()
    fireEvent.click(within(reopened).getByRole('checkbox', { name: '行選択列を表示する' }))
    fireEvent.click(
      within(reopened).getByRole('checkbox', { name: '上下への行固定操作列を表示する' }),
    )
    fireEvent.keyDown(reopened, { key: 'Escape' })

    // Assert
    expect(menuLabels).toEqual(['名前', '種類', 'レベル'])
    expect(hiddenHeaders).toEqual(['名前', '種類', 'レベル'])
    expect(hiddenOrder).toEqual(['みどり', 'あか', 'あお', 'きいろ'])
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: '行 b を選択' }).checked).toBe(
      true,
    )
    expect(screen.getByRole('button', { name: '行 c の固定を解除' })).toBeTruthy()
  })

  it('通常列の可視性が無効でも操作列は設定で切り替えられ、行固定列は既定で隠れる', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ rowSelection: true, rowPinning: true }}
      />,
    )
    const initialSelect = screen.getByRole('checkbox', { name: 'すべての行を選択' })
    const initialPin = screen.queryByRole('button', { name: '行 0 を上端に固定' })

    // Act
    const panel = openSettings()
    fireEvent.click(within(panel).getByRole('checkbox', { name: '行選択列を表示する' }))
    fireEvent.click(within(panel).getByRole('checkbox', { name: '上下への行固定操作列を表示する' }))
    fireEvent.keyDown(panel, { key: 'Escape' })
    const shownPin = screen.getByRole('button', { name: '行 0 を上端に固定' })
    const hiddenSelect = screen.queryByRole('checkbox', { name: 'すべての行を選択' })
    const reset = openSettings()
    fireEvent.click(within(reset).getByRole('button', { name: '表示設定' }))
    fireEvent.keyDown(reset, { key: 'Escape' })

    // Assert
    expect(initialSelect).toBeTruthy()
    expect(initialPin).toBeNull()
    expect(shownPin).toBeTruthy()
    expect(hiddenSelect).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'すべての行を選択' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '行 0 を上端に固定' })).toBeNull()
    expect(screen.queryByRole('button', { name: '表示する列' })).toBeNull()
  })

  it('通常列の表示リセットは操作列を変えず、幅変更は最小幅と既定幅を守る', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{
          rowSelection: true,
          rowPinning: true,
          columnVisibility: true,
          columnResizing: true,
        }}
        initialState={{
          columnVisibility: { __pin__: true, __select__: false },
          columnSizing: { __select__: 40 },
        }}
      />,
    )
    const selectHeader = () => screen.getAllByRole('columnheader')[0]!
    const resizeHandle = screen.getByRole('button', { name: '行選択の列幅を変更' })

    // Act
    const initialHeaderCount = screen.getAllByRole('columnheader').length
    const initialSize = cellSizeOf(selectHeader())
    for (let i = 0; i < 3; i++) fireEvent.keyDown(resizeHandle, { key: 'ArrowLeft' })
    const shrunkSize = cellSizeOf(selectHeader())
    fireEvent.keyDown(resizeHandle, { key: 'ArrowRight', shiftKey: true })
    const widenedSize = cellSizeOf(selectHeader())
    const panel = openSettings()
    fireEvent.click(within(panel).getByRole('button', { name: '列幅' }))
    fireEvent.click(within(panel).getByRole('button', { name: '列の表示' }))
    fireEvent.keyDown(panel, { key: 'Escape' })
    const resetSize = cellSizeOf(selectHeader())
    const resetHeaders = screen.getAllByRole('columnheader').map((header) => header.textContent)

    // Assert
    expect(initialHeaderCount).toBe(4)
    expect(initialSize).toBe('40px')
    expect(shrunkSize).toBe('32px')
    expect(widenedSize).toBe('82px')
    expect(resetSize).toBe('32px')
    expect(resetHeaders).toEqual(['', '名前', '種類', 'レベル'])
  })

  it('表幅は列幅の合計を table の width に直接指定し、列幅の変更に追従する。全幅では指定しない', () => {
    // Arrange
    render(
      <>
        <DataTable
          label="既定の幅"
          data={items}
          columns={columns}
          capabilities={{ columnResizing: true }}
        />
        <DataTable
          label="全幅"
          data={items}
          columns={columns}
          initialLayout={{ fullWidth: true }}
        />
      </>,
    )
    const fittedTable = screen.getByRole('table', { name: '既定の幅' })
    const fullWidthTable = screen.getByRole('table', { name: '全幅' })

    // Act
    const initialWidth = fittedTable.style.width
    fireEvent.keyDown(screen.getByRole('button', { name: '名前の列幅を変更' }), {
      key: 'ArrowRight',
    })
    const resizedWidth = fittedTable.style.width

    // Assert
    expect(initialWidth).toBe('450px')
    expect(resizedWidth).toBe('460px')
    expect(fittedTable.style.getPropertyValue('--table-width')).toBe('')
    expect(fullWidthTable.style.width).toBe('')
    expect(fullWidthTable.className).toContain('w-full')
  })

  it('通常列の可視性能力を無効化して戻しても、操作列の表示設定を変えない', () => {
    // Arrange
    /** 通常列の可視性能力だけを切り替える検証用の表。 */
    function VisibilityTable({ enabled }: { enabled: boolean }) {
      return (
        <DataTable
          data={items}
          columns={columns}
          capabilities={{ columnVisibility: enabled, rowPinning: true }}
          initialLayout={{ showRowPinningColumn: true }}
        />
      )
    }
    const view = render(<VisibilityTable enabled />)
    const menu = openColumnMenu()
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: '名前' }))
    fireEvent.keyDown(menu, { key: 'Escape' })

    // Act
    view.rerender(<VisibilityTable enabled={false} />)
    const disabledHeaders = screen.getAllByRole('columnheader').map((header) => header.textContent)
    view.rerender(<VisibilityTable enabled />)
    const reenabledHeaders = screen.getAllByRole('columnheader').map((header) => header.textContent)

    // Assert
    expect(disabledHeaders).toEqual(['名前', '種類', 'レベル', '固定'])
    expect(reenabledHeaders).toEqual(disabledHeaders)
    expect(screen.getByRole('button', { name: '行 0 を上端に固定' })).toBeTruthy()
  })

  it('通常列の可視性能力が無効な間に利用側が可視性を変えても反映せず、再有効化後も復元しない', () => {
    // Arrange
    /** 通常列の可視性能力を切り替え、利用側から名前の列を隠す操作を持つ検証用の表。 */
    function HostWithHide({ enabled }: { enabled: boolean }) {
      const table = useDataTable({
        data: items,
        columns,
        capabilities: { columnVisibility: enabled },
      })
      return (
        <DataTableView
          table={table}
          toolbar={
            <button
              type="button"
              onClick={() => table.setColumnVisibility((old) => ({ ...old, name: false }))}
            >
              名前を隠す
            </button>
          }
        />
      )
    }
    const view = render(<HostWithHide enabled={false} />)
    const headers = () => screen.getAllByRole('columnheader').map((header) => header.textContent)

    // Act
    fireEvent.click(screen.getByRole('button', { name: '名前を隠す' }))
    const disabledHeaders = headers()
    view.rerender(<HostWithHide enabled />)
    const reenabledHeaders = headers()

    // Assert
    expect(disabledHeaders).toEqual(['名前', '種類', 'レベル'])
    expect(reenabledHeaders).toEqual(['名前', '種類', 'レベル'])
  })

  it('列幅の能力を外した表では、操作列にも幅変更の操作を出さない', () => {
    // Arrange・Act
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ rowSelection: true, rowPinning: true }}
        initialLayout={{ showRowPinningColumn: true }}
      />,
    )

    // Assert
    expect(screen.queryByRole('button', { name: '行選択の列幅を変更' })).toBeNull()
    expect(screen.queryByRole('button', { name: '行の固定の列幅を変更' })).toBeNull()
  })
})

describe('列ごとのフィルタークリア', () => {
  it('待機中の範囲をクリアすると適用せず、他の列の確定値と入力の待機は残す', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    fireEvent.change(within(headerOf('種類')).getByRole('combobox'), { target: { value: '炎' } })
    fireEvent.change(within(headerOf('名前')).getByRole('combobox', { name: '名前を含む' }), {
      target: { value: 'き' },
    })
    fireEvent.change(within(headerOf('レベル')).getAllByRole('spinbutton')[0]!, {
      target: { value: '31' },
    })
    act(() => vi.advanceTimersByTime(200))

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'レベルのフィルターをクリア' }))
    act(() => vi.advanceTimersByTime(500))
    const filtered = firstCells()
    const levelInputs = within(headerOf('レベル'))
      .getAllByRole<HTMLInputElement>('spinbutton')
      .map((input) => input.value)
    const nameInput = within(headerOf('名前')).getByRole<HTMLInputElement>('combobox', {
      name: '名前を含む',
    })

    // Assert
    expect(filtered).toEqual(['きいろ'])
    expect(levelInputs).toEqual(['', ''])
    expect(nameInput.value).toBe('き')
  })

  it('待機中の文字列をクリアすると適用せず、一覧検索の待機は残す', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    fireEvent.change(screen.getByRole('textbox', { name: '一覧を検索' }), {
      target: { value: 'あ' },
    })
    fireEvent.change(within(headerOf('名前')).getByRole('combobox', { name: '名前を含む' }), {
      target: { value: 'み' },
    })
    act(() => vi.advanceTimersByTime(100))

    // Act
    fireEvent.click(screen.getByRole('button', { name: '名前のフィルターをクリア' }))
    act(() => vi.advanceTimersByTime(500))
    const filtered = firstCells()
    const nameValue = within(headerOf('名前')).getByRole<HTMLInputElement>('combobox', {
      name: '名前を含む',
    }).value
    const searchValue = screen.getByRole<HTMLInputElement>('textbox', { name: '一覧を検索' }).value

    // Assert
    expect(filtered).toEqual(['あか', 'あお'])
    expect(nameValue).toBe('')
    expect(searchValue).toBe('あ')
  })

  it('確定した条件をその列だけ解除し、直後の再入力と連続したクリアも扱う', () => {
    // Arrange
    vi.useFakeTimers()
    render(<DataTable data={items} columns={columns} capabilities={listCapabilities} />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const nameInput = () =>
      within(headerOf('名前')).getByRole<HTMLInputElement>('combobox', { name: '名前を含む' })
    const kindSelect = () => within(headerOf('種類')).getByRole<HTMLSelectElement>('combobox')
    fireEvent.change(nameInput(), { target: { value: 'あ' } })
    act(() => vi.advanceTimersByTime(500))
    fireEvent.change(kindSelect(), { target: { value: '炎' } })
    const beforeClear = firstCells()

    // Act
    fireEvent.click(screen.getByRole('button', { name: '名前のフィルターをクリア' }))
    const afterClear = firstCells()
    const clearedName = nameInput().value
    const keptKind = kindSelect().value
    fireEvent.change(nameInput(), { target: { value: 'き' } })
    act(() => vi.advanceTimersByTime(500))
    const reentered = firstCells()
    fireEvent.click(screen.getByRole('button', { name: '名前のフィルターをクリア' }))
    fireEvent.click(screen.getByRole('button', { name: '名前のフィルターをクリア' }))
    act(() => vi.advanceTimersByTime(500))
    const afterRepeatedClear = firstCells()

    // Assert
    expect(beforeClear).toEqual(['あか'])
    expect(afterClear).toEqual(['あか', 'きいろ'])
    expect(clearedName).toBe('')
    expect(keptKind).toBe('炎')
    expect(reentered).toEqual(['きいろ'])
    expect(afterRepeatedClear).toEqual(['あか', 'きいろ'])
  })

  type Variant = {
    id: string
    name: string
    kind: string
    level: number
    rank: number
    active: boolean
    date: string
  }
  const variantColumn = createDataTableColumnHelper<Variant>()
  const variantColumns = [
    variantColumn.accessor('name', {
      header: '名前',
      filterFn: 'includesString',
      meta: { filterVariant: 'text' },
    }),
    variantColumn.accessor('kind', {
      header: '種類',
      filterFn: 'equalsString',
      meta: { filterVariant: 'select' },
    }),
    variantColumn.accessor('level', {
      header: 'レベル',
      filterFn: 'inNumberRange',
      meta: { filterVariant: 'number-range' },
    }),
    variantColumn.accessor('rank', {
      header: 'ランク',
      filterFn: 'equals',
      meta: { filterVariant: 'number-equals' },
    }),
    variantColumn.accessor('active', {
      header: '有効',
      filterFn: 'equals',
      meta: { filterVariant: 'boolean' },
    }),
    variantColumn.accessor('date', {
      header: '日付',
      filterFn: 'dateRange',
      meta: { filterVariant: 'date-range' },
    }),
  ]
  const variantRows: Variant[] = [
    { id: 'a', name: 'あか', kind: '炎', level: 0, rank: 1, active: false, date: '2026-01-01' },
    { id: 'b', name: 'あお', kind: '水', level: 5, rank: 2, active: true, date: '2026-02-01' },
    { id: 'c', name: 'みどり', kind: '草', level: 9, rank: 2, active: true, date: '2026-03-01' },
  ]

  it.each([
    { label: '名前', value: 'み' },
    { label: '種類', value: '水' },
    { label: 'レベル', value: [1, 6] },
    { label: 'ランク', value: 1 },
    { label: '有効', value: false },
    { label: '日付', value: ['2026-02-01', undefined] },
  ])('初期状態の$labelの条件をクリアすると、初期値に戻さず条件を空にする', ({ label, value }) => {
    // Arrange
    const columnId = variantColumns.find((c) => c.header === label)!.accessorKey!
    render(
      <DataTable
        data={variantRows}
        columns={variantColumns}
        capabilities={listCapabilities}
        initialState={{ columnFilters: [{ id: columnId, value }] }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const filteredCount = firstCells().length

    // Act
    fireEvent.click(screen.getByRole('button', { name: `${label}のフィルターをクリア` }))
    // 日付の入力欄は役割を持たないため、入力要素をまとめて読む
    const inputValues = Array.from(
      headerOf(label).querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select'),
      (input) => input.value,
    )

    // Assert
    expect(filteredCount).toBeLessThan(variantRows.length)
    expect(firstCells()).toEqual(['あか', 'あお', 'みどり'])
    expect(inputValues.length).toBeGreaterThan(0)
    expect(inputValues.every((text) => text === '')).toBe(true)
    expect(screen.queryByRole('button', { name: '絞り込みを解除' })).toBeNull()
  })
})

describe('外からの絞り込みの解除', () => {
  /** 表の外に、絞り込みを解除する操作を持つ一覧。 */
  function ExternallyClearedTable() {
    const table = useDataTable({ data: items, columns, capabilities: listCapabilities })
    return (
      <>
        <button onClick={() => table.clearFilters()}>外からすべて解除</button>
        <button onClick={() => table.getColumn('name')!.clearFilter()}>外から名前を解除</button>
        <button onClick={() => table.reset()}>外から初期化</button>
        <button onClick={() => table.getColumn('name')!.setFilterValue('み')}>
          外から名前を設定
        </button>
        <DataTableView table={table} />
      </>
    )
  }

  /** 一覧検索と名前の列フィルターに入力し、反映を待っている状態にする。 */
  function typePendingFilters() {
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    fireEvent.change(screen.getByRole('textbox', { name: '一覧を検索' }), {
      target: { value: 'あ' },
    })
    // 待機中に見出しの属性が変わるため、入力欄は名前で取る
    fireEvent.change(screen.getByRole('combobox', { name: '名前を含む' }), {
      target: { value: 'か' },
    })
    act(() => vi.advanceTimersByTime(100))
  }

  it('待機中に外から clearFilters を呼ぶと、一覧検索と列フィルターの入力を適用しない', () => {
    // Arrange
    vi.useFakeTimers()
    render(<ExternallyClearedTable />)
    typePendingFilters()

    // Act
    fireEvent.click(screen.getByRole('button', { name: '外からすべて解除' }))
    act(() => vi.advanceTimersByTime(500))
    const searchValue = screen.getByRole<HTMLInputElement>('textbox', { name: '一覧を検索' }).value
    const nameValue = screen.getByRole<HTMLInputElement>('combobox', { name: '名前を含む' }).value

    // Assert
    expect(firstCells()).toEqual(['あか', 'あお', 'みどり', 'きいろ'])
    expect(searchValue).toBe('')
    expect(nameValue).toBe('')
  })

  it('待機中に外から列の clearFilter を呼ぶと、その列の入力だけを捨て、一覧検索の入力は適用する', () => {
    // Arrange
    vi.useFakeTimers()
    render(<ExternallyClearedTable />)
    typePendingFilters()

    // Act
    fireEvent.click(screen.getByRole('button', { name: '外から名前を解除' }))
    act(() => vi.advanceTimersByTime(500))
    const nameValue = screen.getByRole<HTMLInputElement>('combobox', { name: '名前を含む' }).value

    // Assert
    expect(firstCells()).toEqual(['あか', 'あお'])
    expect(nameValue).toBe('')
  })

  it('待機中に外から列の値を設定すると、待機中の入力を適用せず、入力欄に設定した値を表示する', () => {
    // Arrange
    vi.useFakeTimers()
    render(<ExternallyClearedTable />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    fireEvent.change(screen.getByRole('combobox', { name: '名前を含む' }), {
      target: { value: 'か' },
    })
    act(() => vi.advanceTimersByTime(100))

    // Act
    fireEvent.click(screen.getByRole('button', { name: '外から名前を設定' }))
    act(() => vi.advanceTimersByTime(500))
    const nameValue = screen.getByRole<HTMLInputElement>('combobox', { name: '名前を含む' }).value

    // Assert
    expect(firstCells()).toEqual(['みどり'])
    expect(nameValue).toBe('み')
  })

  it.each([
    {
      name: '一覧検索',
      type: () =>
        fireEvent.change(screen.getByRole('textbox', { name: '一覧を検索' }), {
          target: { value: 'あ' },
        }),
      input: () => screen.getByRole<HTMLInputElement>('textbox', { name: '一覧を検索' }),
    },
    {
      name: '文字列の列フィルター',
      type: () =>
        fireEvent.change(screen.getByRole('combobox', { name: '名前を含む' }), {
          target: { value: 'あ' },
        }),
      input: () => screen.getByRole<HTMLInputElement>('combobox', { name: '名前を含む' }),
    },
  ])(
    '$name の入力を待っている間に、解除の前に table.reset() を呼ぶと、待機中の入力を適用せず入力欄を空にする',
    ({ type, input }) => {
      // Arrange
      vi.useFakeTimers()
      render(<ExternallyClearedTable />)
      fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
      type()
      act(() => vi.advanceTimersByTime(100))

      // Act
      fireEvent.click(screen.getByRole('button', { name: '外から初期化' }))
      act(() => vi.advanceTimersByTime(500))

      // Assert
      expect(firstCells()).toEqual(['あか', 'あお', 'みどり', 'きいろ'])
      expect(input().value).toBe('')
    },
  )

  it('範囲の入力を待っている間に table.reset() を呼ぶと、待機中の入力を適用しない', () => {
    // Arrange
    vi.useFakeTimers()
    render(<ExternallyClearedTable />)
    fireEvent.click(screen.getByRole('button', { name: '列フィルター' }))
    const min = screen.getByRole('spinbutton', { name: 'レベルの最小値' })
    fireEvent.change(min, { target: { value: '10' } })
    act(() => vi.advanceTimersByTime(100))

    // Act
    fireEvent.click(screen.getByRole('button', { name: '外から初期化' }))
    act(() => vi.advanceTimersByTime(500))

    // Assert
    expect(firstCells()).toEqual(['あか', 'あお', 'みどり', 'きいろ'])
  })
})

describe('設定パネル', () => {
  it('固定とグループ化のボタンを既定では隠し、設定から表示できる', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ columnPinning: true, grouping: true }}
      />,
    )
    const initiallyHidden = screen.queryAllByRole('button', { name: /に固定|でグループ化/ })

    // Act
    const panel = openSettings()
    const pinToggle = within(panel).getByRole<HTMLInputElement>('checkbox', {
      name: '見出しに固定ボタンを表示する',
    })
    const groupToggle = within(panel).getByRole<HTMLInputElement>('checkbox', {
      name: '見出しにグループ化ボタンを表示する',
    })
    const initialChecks = [pinToggle.checked, groupToggle.checked]
    fireEvent.click(pinToggle)
    fireEvent.click(groupToggle)
    fireEvent.keyDown(panel, { key: 'Escape' })

    // Assert
    expect(initiallyHidden).toEqual([])
    expect(initialChecks).toEqual([false, false])
    expect(screen.getByRole('button', { name: 'レベルの列を先頭に固定' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '種類でグループ化' })).toBeTruthy()
  })

  it('グループ化ボタンを隠してもグループを保ち、表示設定のリセットで既定の非表示へ戻す', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ grouping: true }}
        initialLayout={{ showColumnGroupingButtons: false }}
      />,
    )
    const panel = openSettings()
    fireEvent.click(
      within(panel).getByRole('checkbox', { name: '見出しにグループ化ボタンを表示する' }),
    )
    fireEvent.keyDown(panel, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: '種類でグループ化' }))
    const groupedRows = firstCells()

    // Act
    const hidePanel = openSettings()
    fireEvent.click(
      within(hidePanel).getByRole('checkbox', { name: '見出しにグループ化ボタンを表示する' }),
    )
    fireEvent.keyDown(hidePanel, { key: 'Escape' })
    const rowsWhileHidden = firstCells()
    const hiddenButtons = screen.queryAllByRole('button', {
      name: /でグループ化|のグループ化を解除/,
    })
    const resetPanel = openSettings()
    fireEvent.click(
      within(resetPanel).getByRole('checkbox', { name: '見出しにグループ化ボタンを表示する' }),
    )
    fireEvent.click(within(resetPanel).getByRole('button', { name: '表示設定' }))
    fireEvent.keyDown(resetPanel, { key: 'Escape' })

    // Assert
    expect(groupedRows).toEqual(['炎(2)', '水(1)', '草(1)'])
    expect(rowsWhileHidden).toEqual(groupedRows)
    expect(firstCells()).toEqual(groupedRows)
    expect(hiddenButtons).toEqual([])
    expect(screen.queryByRole('button', { name: '種類のグループ化を解除' })).toBeNull()
  })

  it('入力UIのない列とフィルター無効の列には解除ボタンも出さない', () => {
    // Arrange
    const mixedColumns = [
      columns[0]!,
      column.accessor('id', { header: 'ID' }),
      column.accessor('level', {
        header: 'レベル',
        enableColumnFilter: false,
        meta: { filterVariant: 'number-range' },
      }),
    ]

    // Act
    render(
      <DataTable
        data={items}
        columns={mixedColumns}
        capabilities={listCapabilities}
        initialLayout={{ showColumnFilters: true }}
      />,
    )
    const clearButtons = screen
      .getAllByRole('button', { name: /のフィルターをクリア/ })
      .map((button) => button.getAttribute('aria-label'))

    // Assert
    expect(clearButtons).toEqual(['名前のフィルターをクリア'])
    expect(screen.getByRole('combobox', { name: '名前を含む' })).toBeTruthy()
    expect(screen.queryByRole('spinbutton', { name: 'レベルの最小値' })).toBeNull()
  })

  it('ヘッダー・本文・フッターと同じ枠にパネルを置き、表外の操作を妨げない', () => {
    // Arrange
    render(
      <>
        <button type="button">アプリの操作</button>
        <DataTable
          label="対象の表"
          data={items}
          columns={columns}
          capabilities={{ ...listCapabilities, cellSelection: true }}
        />
        <DataTable label="別の表" data={items} columns={columns} capabilities={listCapabilities} />
      </>,
    )
    const targetTable = screen.getByRole('table', { name: '対象の表' })
    const otherTable = screen.getByRole('table', { name: '別の表' })
    const outsideButton = screen.getByRole('button', { name: 'アプリの操作' })
    const footer = screen.getByRole('group', { name: 'セル選択の状態' })
    const trigger = screen.getAllByRole('button', { name: 'テーブルの設定' })[0]!

    // Act
    const panel = openSettings(0)
    const frame = panel.parentElement!
    outsideButton.focus()
    fireEvent.click(within(otherTable).getByRole('button', { name: '名前' }))
    const outsideFocus = document.activeElement

    // Assert
    expect(frame.contains(targetTable)).toBe(true)
    expect(frame.contains(trigger)).toBe(true)
    expect(frame.contains(footer)).toBe(true)
    expect(
      within(footer).getByRole('button', { name: '選択したセルをコピー', hidden: true }),
    ).toBeTruthy()
    expect(frame.contains(otherTable)).toBe(false)
    expect(targetTable.closest('[inert]')).not.toBeNull()
    expect(otherTable.closest('[inert], [aria-hidden="true"]')).toBeNull()
    expect(outsideButton.closest('[inert], [aria-hidden="true"]')).toBeNull()
    expect(panel.getAttribute('aria-modal')).toBeNull()
    expect(screen.getByRole('table', { name: '別の表' })).toBe(otherTable)
    expect(outsideFocus).toBe(outsideButton)
    expect(document.body.style.pointerEvents).not.toBe('none')
  })

  it('設定中は対象の表だけを隠し、リセット後に閉じると設定ボタンへ戻す', async () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={listCapabilities}
        initialState={{ sorting: [{ id: 'level', desc: true }] }}
      />,
    )
    const toggle = screen.getByRole('button', { name: 'テーブルの設定' })
    toggle.focus()

    // Act
    fireEvent.click(toggle)
    const panel = screen.getByRole('dialog', { name: 'テーブルの設定' })
    const focusedInPanel = panel.contains(document.activeElement)
    const tableWhileOpen = screen.queryByRole('table')
    fireEvent.click(within(panel).getByRole('button', { name: '並び替え' }))
    fireEvent.keyDown(panel, { key: 'Escape' })
    const afterReset = firstCells()

    // Assert
    expect(focusedInPanel).toBe(true)
    expect(tableWhileOpen).toBeNull()
    expect(afterReset).toEqual(['あか', 'あお', 'みどり', 'きいろ'])
    expect(screen.queryByRole('dialog')).toBeNull()
    // フォーカスは閉じた後のタスクで戻る
    await waitFor(() => expect(document.activeElement).toBe(toggle))
  })

  it('固定ボタンを隠しても列の固定を保ち、表示設定のリセットで初期値へ戻す', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ columnPinning: true }}
        initialLayout={{ showColumnPinningButtons: true }}
        settings
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'レベルの列を先頭に固定' }))

    // Act
    const panel = openSettings()
    fireEvent.click(within(panel).getByRole('checkbox', { name: '見出しに固定ボタンを表示する' }))
    fireEvent.keyDown(panel, { key: 'Escape' })
    const pinButtonsWhileHidden = screen.queryAllByRole('button', { name: /列の固定を解除|に固定/ })
    const pinnedHeader = screen.getAllByRole('columnheader')[0]!
    const resetPanel = openSettings()
    fireEvent.click(within(resetPanel).getByRole('button', { name: '表示設定' }))
    fireEvent.keyDown(resetPanel, { key: 'Escape' })

    // Assert
    expect(pinButtonsWhileHidden).toEqual([])
    expect(pinnedHeader.textContent).toBe('レベル')
    expect(pinnedHeader.dataset.isPinned).toBe('start')
    expect(screen.getByRole('button', { name: 'レベルの列の固定を解除' })).toBeTruthy()
  })

  it('固定列が重なりうる幅では警告から原因の設定を示し、戻すと警告を消して戻した設定へフォーカスする', () => {
    // Arrange
    render(
      <DataTable
        data={items}
        columns={columns}
        capabilities={{ columnPinning: true }}
        initialLayout={{ showColumnPinningButtons: true }}
        settings
      />,
    )
    const panel = openSettings()
    const warningBeforePin = within(panel).queryByRole('button', {
      name: '固定列が重なる場合があります',
    })
    fireEvent.click(within(panel).getByRole('checkbox', { name: '枠の幅に広げる' }))
    fireEvent.keyDown(panel, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'レベルの列を先頭に固定' }))

    // Act
    const pinnedPanel = openSettings()
    const warning = within(pinnedPanel).getByRole('button', {
      name: '固定列が重なる場合があります',
    })
    fireEvent.click(warning)
    const expanded = warning.getAttribute('aria-expanded')
    const causes = within(pinnedPanel)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    fireEvent.click(
      within(pinnedPanel).getByRole('button', { name: '「枠の幅に広げる」をオフにする' }),
    )

    // Assert
    expect(warningBeforePin).toBeNull()
    expect(expanded).toBe('true')
    expect(causes).toEqual(['「枠の幅に広げる」がオンオフにする'])
    expect(
      within(pinnedPanel).queryByRole('button', { name: '固定列が重なる場合があります' }),
    ).toBeNull()
    expect(document.activeElement).toBe(
      within(pinnedPanel).getByRole('checkbox', { name: '枠の幅に広げる' }),
    )
  })

  it.each([
    { heightStrategy: undefined, fillsParent: true, height: '', maxHeight: '' },
    { heightStrategy: 'content' as const, fillsParent: false, height: '', maxHeight: '' },
    { heightStrategy: 'fixed' as const, fillsParent: false, height: '320px', maxHeight: '' },
    { heightStrategy: 'max' as const, fillsParent: false, height: '', maxHeight: '320px' },
  ])(
    '高さの決め方 $heightStrategy では、スクロール領域の高さを表示設定だけで決める',
    ({ heightStrategy, fillsParent, height, maxHeight }) => {
      // Act
      render(
        <DataTable
          label="高さ"
          data={items}
          columns={columns}
          capabilities={listCapabilities}
          initialLayout={heightStrategy && { heightStrategy, height: 320 }}
        />,
      )
      const scrollArea = screen.getByRole('table', { name: '高さ' }).parentElement!

      // Assert
      expect(scrollArea.classList.contains('flex-1')).toBe(fillsParent)
      expect(scrollArea.style.height).toBe(height)
      expect(scrollArea.style.maxHeight).toBe(maxHeight)
    },
  )

  it('CSS の長さで指定した上限は、パネルで px を入力するまで使い、表示設定のリセットで戻す', () => {
    // Arrange
    render(
      <DataTable
        label="高さ"
        data={items}
        columns={columns}
        capabilities={listCapabilities}
        initialLayout={{ heightStrategy: 'max', height: '40vh' }}
      />,
    )
    const scrollArea = () => screen.getByRole('table', { name: '高さ' }).parentElement!
    const initialMaxHeight = scrollArea().style.maxHeight

    // Act
    const panel = openSettings()
    const input = within(panel).getByRole<HTMLInputElement>('spinbutton', {
      name: '高さの上限（px）',
    })
    const initialInput = { value: input.value, placeholder: input.placeholder }
    fireEvent.change(input, { target: { value: '300' } })
    fireEvent.keyDown(panel, { key: 'Escape' })
    const changedMaxHeight = scrollArea().style.maxHeight
    const resetPanel = openSettings()
    fireEvent.click(within(resetPanel).getByRole('button', { name: '表示設定' }))
    fireEvent.keyDown(resetPanel, { key: 'Escape' })
    const resetMaxHeight = scrollArea().style.maxHeight

    // Assert
    expect(initialMaxHeight).toBe('40vh')
    expect(initialInput).toEqual({ value: '', placeholder: '40vh' })
    expect(changedMaxHeight).toBe('300px')
    expect(resetMaxHeight).toBe('40vh')
  })

  it('パネルで高さを指定すると、上限ではなく指定の高さにする', () => {
    // Arrange
    render(
      <DataTable
        label="高さ"
        data={items}
        columns={columns}
        capabilities={listCapabilities}
        initialLayout={{ heightStrategy: 'max', height: '40vh' }}
      />,
    )
    const scrollArea = () => screen.getByRole('table', { name: '高さ' }).parentElement!

    // Act
    const panel = openSettings()
    fireEvent.click(within(panel).getByRole('radio', { name: '高さを指定する' }))
    fireEvent.change(within(panel).getByRole('spinbutton', { name: '高さ（px）' }), {
      target: { value: '300' },
    })
    fireEvent.keyDown(panel, { key: 'Escape' })

    // Assert
    expect(scrollArea().style.height).toBe('300px')
    expect(scrollArea().style.maxHeight).toBe('')
    expect(scrollArea().classList.contains('flex-1')).toBe(false)
  })

  it('同じ画面の複数の表では、開いた表の設定だけを変える', () => {
    // Arrange
    render(
      <>
        <DataTable
          label="表1"
          data={items}
          columns={columns}
          capabilities={{ columnPinning: true }}
          initialLayout={{ showColumnPinningButtons: true }}
        />
        <DataTable
          label="表2"
          data={items}
          columns={columns}
          capabilities={{ columnPinning: true }}
          initialLayout={{ showColumnPinningButtons: true }}
        />
      </>,
    )

    // Act
    const panel = openSettings(0)
    fireEvent.click(within(panel).getByRole('checkbox', { name: '見出しに固定ボタンを表示する' }))
    fireEvent.keyDown(panel, { key: 'Escape' })
    const firstTableButtons = within(screen.getByRole('table', { name: '表1' })).queryAllByRole(
      'button',
      { name: /に固定/ },
    )
    const secondTableButtons = within(screen.getByRole('table', { name: '表2' })).queryAllByRole(
      'button',
      { name: /に固定/ },
    )

    // Assert
    expect(firstTableButtons).toEqual([])
    expect(secondTableButtons).toHaveLength(6)
  })
})
