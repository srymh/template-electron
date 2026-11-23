import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  listRows: vi.fn(),
  createRow: vi.fn(),
  updateRow: vi.fn(),
  removeRow: vi.fn(),
}))

vi.mock('@your-app-name/api/renderer', () => ({
  storageDemo: { tables: api },
}))

import { TableEditorSection } from './table-editor-section'

/** テストで使う列定義を作る。省略した項目は編集不可・制約なしにする。 */
const column = (
  name: string,
  dataType: string,
  options: {
    pk?: number
    editable?: boolean
    notNull?: boolean
    allowedValueOptions?: Array<{ value: string | number | null; label: string | null }>
  } = {},
) => ({
  name,
  dataType,
  notNull: options.notNull ?? false,
  defaultValue: null,
  primaryKeyOrder: options.pk ?? null,
  editable: options.editable ?? false,
  allowedValues: options.allowedValueOptions?.map(({ value }) => value) ?? null,
  allowedValueOptions: options.allowedValueOptions ?? null,
})

const itemDefinition = {
  tableName: 'demo_item',
  displayName: '項目',
  columns: [
    column('id', 'INTEGER', { pk: 1 }),
    column('title', 'TEXT', { editable: true, notNull: true }),
    column('status', 'TEXT', {
      editable: true,
      notNull: true,
      allowedValueOptions: [
        { value: 'draft', label: null },
        { value: 'published', label: null },
      ],
    }),
    column('category_id', 'INTEGER', {
      editable: true,
      allowedValueOptions: [
        { value: null, label: '未分類' },
        { value: 1, label: '資料' },
      ],
    }),
  ],
  primaryKey: ['id'],
  uniqueKeys: [],
  foreignKeys: [],
  schemaSql: 'CREATE TABLE demo_item (...)',
}

beforeEach(() => {
  vi.clearAllMocks()
  api.list.mockResolvedValue([itemDefinition])
  api.listRows.mockResolvedValue({
    tableName: 'demo_item',
    rows: [{ id: 1, title: '最初の項目', status: 'published', category_id: 1 }],
    rowLabels: [{ category_id: '資料' }],
    total: 1,
    range: { type: 'all' },
  })
  api.createRow.mockResolvedValue({ tableName: 'demo_item', row: {} })
  api.updateRow.mockResolvedValue({ tableName: 'demo_item', changed: true })
})

/** 取得の再試行をしない QueryClient で区画を描画する。 */
function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <TableEditorSection />
    </QueryClientProvider>,
  )
}

describe('TableEditorSection', () => {
  it('行の値と参照先のラベルを一覧に表示する', async () => {
    // Arrange / Act
    renderSection()

    // Assert
    const table = await screen.findByRole('table', { name: '項目の行' })
    expect(within(table).getByText('最初の項目')).toBeDefined()
    expect(within(table).getByText('（資料）')).toBeDefined()
  })

  it('追加フォームの入力を列の型に合わせて送信する', async () => {
    // Arrange
    renderSection()
    await screen.findByRole('table', { name: '項目の行' })
    fireEvent.click(screen.getByRole('button', { name: '行を追加' }))

    // Act
    fireEvent.change(screen.getByLabelText(/^id/), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/^title/), { target: { value: '新しい項目' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    // Assert: 数値列は数値に、未分類の選択は NULL にする
    await waitFor(() => expect(api.createRow).toHaveBeenCalledTimes(1))
    expect(api.createRow.mock.calls[0]?.[0]).toEqual({
      tableName: 'demo_item',
      row: { id: 2, title: '新しい項目', status: 'draft', category_id: null },
    })
  })

  it('更新フォームでは変更した列だけを主キー付きで送信する', async () => {
    // Arrange
    renderSection()
    const table = await screen.findByRole('table', { name: '項目の行' })
    fireEvent.click(within(table).getByRole('button', { name: '行を更新' }))

    // Act
    fireEvent.change(screen.getByLabelText(/^status/), { target: { value: 'draft' } })
    fireEvent.click(screen.getByRole('button', { name: '更新' }))

    // Assert
    await waitFor(() => expect(api.updateRow).toHaveBeenCalledTimes(1))
    expect(api.updateRow.mock.calls[0]?.[0]).toEqual({
      tableName: 'demo_item',
      key: { id: 1 },
      changes: { status: 'draft' },
    })
  })

  it('行を変更した後は、参照先の選択肢を含むテーブル定義を取り直す', async () => {
    // Arrange: 分類の名前を変えた後の定義を、2回目の取得で返す
    const renamedDefinition = {
      ...itemDefinition,
      columns: itemDefinition.columns.map((tableColumn) =>
        tableColumn.name === 'category_id'
          ? {
              ...tableColumn,
              allowedValueOptions: [
                { value: null, label: '未分類' },
                { value: 1, label: '文書' },
              ],
            }
          : tableColumn,
      ),
    }
    api.list.mockResolvedValueOnce([itemDefinition]).mockResolvedValue([renamedDefinition])
    renderSection()
    const table = await screen.findByRole('table', { name: '項目の行' })
    fireEvent.click(within(table).getByRole('button', { name: '行を更新' }))
    fireEvent.change(screen.getByLabelText(/^title/), { target: { value: '変更後' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: '更新' }))
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: '行を追加' }))

    // Assert
    const categorySelect = await screen.findByLabelText(/^category_id/)
    await waitFor(() =>
      expect(within(categorySelect).getByRole('option', { name: '文書' })).toBeDefined(),
    )
    expect(within(categorySelect).queryByRole('option', { name: '資料' })).toBeNull()
  })
})
