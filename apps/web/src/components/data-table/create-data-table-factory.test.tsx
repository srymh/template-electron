import { useState } from 'react'

import { afterEach, expect, expectTypeOf, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

import { createDataTableFactory } from './create-data-table-factory'
import type { DataTableFactoryOptions, DataTableFactoryProps } from './create-data-table-factory'
import type { DataTableProps } from './data-table'
import type { DataTableCoreTable } from './features'
import { createAppTable } from './use-app-table'
import type { DataTableColumnHelper } from './use-app-table'
import type { DataTableOptions } from './use-data-table'

type Item = { id: string; name: string }
type EditorMeta = {
  draft: string
  busy: boolean
  onChange: (value: string) => void
  onSave: () => void
}
const editor = createDataTableFactory<EditorMeta>()
const column = editor.createDataTableColumnHelper<Item>()
const data: Item[] = [{ id: 'a', name: '元の値' }]

/** セルから値を受け取り、編集と保存を行う。coreのテーブルは参照しない。 */
function EditorCell({ draft, busy, onChange, onSave }: EditorMeta) {
  return (
    <>
      <input
        aria-label="編集値"
        value={draft}
        disabled={busy}
        onChange={(event) => onChange(event.target.value)}
      />
      <button disabled={busy} onClick={onSave}>
        保存
      </button>
    </>
  )
}
const columns = column.columns([
  column.accessor('name', {
    header: '値',
    cell: ({ table }) => {
      const { draft, busy, onChange, onSave } = editor.getMeta(table)
      expectTypeOf(editor.getMeta(table)).toEqualTypeOf<EditorMeta>()
      expectTypeOf(draft).toEqualTypeOf<string>()
      expectTypeOf(table.options.meta!.dataTable.layout.tableFixed).toEqualTypeOf<boolean>()
      return <EditorCell draft={draft} busy={busy} onChange={onChange} onSave={onSave} />
    },
  }),
])

/** 安定した列に、入力中の値だけをmetaから渡す。 */
function EditableTable() {
  const [draft, setDraft] = useState('入力前')
  const table = editor.useDataTable({
    data,
    columns,
    meta: { draft, busy: false, onChange: setDraft, onSave: () => {} },
  })
  return (
    <>
      <output aria-label="現在の下書き">{draft}</output>
      <editor.DataTableView table={table} label="編集表" />
    </>
  )
}

afterEach(cleanup)

it('metaの値だけを更新すると、入力欄の要素とフォーカスを保って新しい値を表示する', () => {
  // Arrange
  render(<EditableTable />)
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: '編集値' })
  input.focus()
  expect(input.value).toBe('入力前')

  // Act
  fireEvent.change(input, { target: { value: '入力後' } })
  const updatedInput = screen.getByRole<HTMLInputElement>('textbox', { name: '編集値' })

  // Assert
  expect(updatedInput).toBe(input)
  expect(updatedInput.value).toBe('入力後')
  expect(screen.getByLabelText('現在の下書き').textContent).toBe('入力後')
  expect(document.activeElement).toBe(input)
})

it('metaの処理中と操作関数を差し替えると、同じ操作要素で最新の値と関数を使う', () => {
  // Arrange
  const oldSave = vi.fn()
  const nextSave = vi.fn()
  const onChange = vi.fn()
  const view = render(
    <editor.DataTable
      data={data}
      columns={columns}
      meta={{ draft: '前', busy: false, onChange, onSave: oldSave }}
    />,
  )
  const button = screen.getByRole<HTMLButtonElement>('button', { name: '保存' })

  // Act
  view.rerender(
    <editor.DataTable
      data={data}
      columns={columns}
      meta={{ draft: '後', busy: true, onChange, onSave: nextSave }}
    />,
  )
  const disabledDuringUpdate = button.disabled
  view.rerender(
    <editor.DataTable
      data={data}
      columns={columns}
      meta={{ draft: '後', busy: false, onChange, onSave: nextSave }}
    />,
  )
  fireEvent.click(button)

  // Assert
  expect(disabledDuringUpdate).toBe(true)
  expect(screen.getByRole('button', { name: '保存' })).toBe(button)
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: '編集値' }).value).toBe('後')
  expect(oldSave).not.toHaveBeenCalled()
  expect(nextSave).toHaveBeenCalledOnce()
})

const counter = createDataTableFactory<{ count: number }>()
const counterColumn = counter.createDataTableColumnHelper<Item>()
const counterColumns = counterColumn.columns([
  counterColumn.accessor('name', {
    header: '件数',
    cell: ({ table }) => <output>{counter.getMeta(table).count}</output>,
  }),
])

it('異なるmeta型のfactoryを入れ子にしても、それぞれのコンテキストで表示する', () => {
  // Arrange
  const onChange = vi.fn()
  const onSave = vi.fn()

  // Act
  render(
    <editor.DataTable
      label="外側"
      data={data}
      columns={columns}
      meta={{ draft: '外側の値', busy: false, onChange, onSave }}
      toolbar={
        <counter.DataTable label="内側" data={data} columns={counterColumns} meta={{ count: 42 }} />
      }
    />,
  )

  // Assert
  expect(
    within(screen.getByRole('table', { name: '外側' })).getByRole<HTMLInputElement>('textbox', {
      name: '編集値',
    }).value,
  ).toBe('外側の値')
  expect(within(screen.getByRole('table', { name: '内側' })).getByText('42')).toBeTruthy()
})

it('利用側metaと内部metaを型で分け、内部の予約キーを利用側から設定させない', () => {
  // Arrange
  type Options = DataTableFactoryOptions<Item, { count: number }>
  const options: Options = { data, columns: counterColumns, meta: { count: 1 } }

  // Act
  const invalidOptions: Options = {
    ...options,
    // @ts-expect-error dataTableはfactoryが所有する予約キー。
    meta: { count: 1, dataTable: {} },
  }

  // @ts-expect-error factoryで宣言したmetaは省略できない。
  const missingMeta: Options = { data, columns: counterColumns }
  const defaultOptions: DataTableOptions<Item> = {
    data,
    columns: [],
    // @ts-expect-error 既定APIへ型のない利用側metaを渡させない。
    meta: { count: 1 },
  }
  const mixedColumns: Options = {
    ...options,
    // @ts-expect-error 異なるmeta型のfactoryで作った列は混ぜられない。
    columns,
  }

  const defaultProps: DataTableProps<Item> = {
    data,
    columns: [],
    // @ts-expect-error 既定のDataTableへも利用側metaを渡させない。
    meta: { count: 1 },
  }

  // Assert
  expectTypeOf(options.meta.count).toEqualTypeOf<number>()
  expectTypeOf<Parameters<typeof counter.useDataTable<Item>>[0]>().toEqualTypeOf<Options>()
  expectTypeOf(counter.createDataTableColumnHelper<Item>()).toEqualTypeOf<
    DataTableColumnHelper<Item, { count: number }>
  >()
  expectTypeOf(counter.createDataTableColumnHelper<Item>()).not.toEqualTypeOf<
    DataTableColumnHelper<Item, EditorMeta>
  >()
  expectTypeOf<Parameters<typeof counter.DataTable<Item>>[0]>().toEqualTypeOf<
    DataTableFactoryProps<Item, { count: number }>
  >()
  void invalidOptions
  void defaultProps
  void missingMeta
  void defaultOptions
  void mixedColumns
})

it('getMetaは、同じfactoryのmetaがないテーブルを渡すと例外にし、別のmeta型のテーブルは型で拒否する', () => {
  // Arrange
  // 共通部品を通さずに作ったテーブルを渡すため、DOM に依存しないフックのホストだけをサーバーで描画する
  const { useAppTable } = createAppTable<{ count: number }>()
  /** 作ったテーブルを、描画の外で使えるよう呼び出し側へ渡す。 */
  function TableHost({
    onTable,
  }: {
    onTable: (table: DataTableCoreTable<Item, { count: number }>) => void
  }) {
    onTable(useAppTable({ columns: [], data }))
    return null
  }
  let tableWithoutMeta: DataTableCoreTable<Item, { count: number }> | undefined
  renderToStaticMarkup(<TableHost onTable={(created) => (tableWithoutMeta = created)} />)

  // Act
  const readMeta = () => counter.getMeta(tableWithoutMeta!)
  // @ts-expect-error 別のmeta型のfactoryのテーブルからは読めない。
  const readOtherMeta = () => editor.getMeta(tableWithoutMeta!)

  // Assert
  expect(readMeta).toThrow('利用側metaは、同じfactoryの useDataTable で作ったテーブルから読む')
  void readOtherMeta
})
