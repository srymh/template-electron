import { useId, useMemo, useState } from 'react'

import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Label } from '@repo/ui/components/label'
import { NativeSelect, NativeSelectOption } from '@repo/ui/components/native-select'
import type { StorageDemoTableName } from '@your-app-name/api/storage-demo'

import { createDataTableFactory } from '@/components/data-table'

import {
  useStorageDemoRowMutations,
  useStorageDemoRows,
  useStorageDemoTables,
} from '../api/storage-demo'
import {
  formColumns,
  initialInputs,
  primaryKeyId,
  primaryKeyOf,
  toInputValue,
} from '../utils/table-values'
import type { TableDefinition, TableRow } from '../utils/table-values'
import { RowForm } from './row-form'
import type { RowFormMode } from './row-form'

/** 一覧の一行。行の値と、参照先の表示ラベルの組。 */
type RowEntry = { row: TableRow; labels: Readonly<Record<string, string | null>> }

/** 一覧のセルから使う、処理中の状態と行の操作。 */
type RowListMeta = {
  isBusy: boolean
  onEdit: (row: TableRow) => void
  onRemove: (row: TableRow) => void
}

const rowTable = createDataTableFactory<RowListMeta>()

const rowCapabilities = { globalFiltering: true, sorting: true, pagination: true }

/**
 * SQLite テーブル編集のデモ区画。sqlite-table-editor が SQLite の metadata から読んだ定義をもとに、
 * 選んだテーブルの行の一覧・追加・更新・削除を行う。
 */
export function TableEditorSection() {
  const tables = useStorageDemoTables()

  if (tables.isPending) return <p className="text-sm">読み込み中...</p>
  if (tables.isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        テーブル定義を取得できませんでした: {tables.error.message}
      </p>
    )
  }

  return <TableEditor definitions={tables.data} />
}

/** テーブルの選択と、選んだテーブルの行の一覧・入力フォームをまとめる。 */
function TableEditor({ definitions }: { definitions: TableDefinition[] }) {
  const tableSelectId = useId()
  const [tableName, setTableName] = useState<StorageDemoTableName>(
    definitions[0]?.tableName ?? 'demo_item',
  )
  const [formMode, setFormMode] = useState<RowFormMode | null>(null)
  const rows = useStorageDemoRows(tableName)
  const { create, update, remove } = useStorageDemoRowMutations()
  const definition = definitions.find((candidate) => candidate.tableName === tableName)

  // 列は定義の構造だけに依存させ、行の取得のたびに作り直さない。
  const columns = useMemo(() => (definition ? createRowColumns(definition) : []), [definition])
  // 切り替え前のテーブルの行は、列が合わないため表示しない。
  const entries = useMemo<RowEntry[]>(() => {
    const result = rows.data
    if (result?.tableName !== tableName) return []
    return result.rows.map((row, index) => ({ row, labels: result.rowLabels[index] ?? {} }))
  }, [rows.data, tableName])

  if (!definition) return null

  // 直前の操作の失敗。エラー文には SQLite の制約違反の内容がそのまま入る。
  const mutationError = create.error ?? update.error ?? remove.error

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        列の型・主キー・外部キー・選択肢は SQLite の metadata と登録した設定から決まります。
      </p>

      {/* テーブルの選択と追加の操作 */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={tableSelectId}>テーブル</Label>
          <NativeSelect
            id={tableSelectId}
            value={tableName}
            onChange={(event) => {
              setTableName(event.currentTarget.value as StorageDemoTableName)
              setFormMode(null)
            }}
          >
            {definitions.map((candidate) => (
              <NativeSelectOption key={candidate.tableName} value={candidate.tableName}>
                {candidate.displayName}（{candidate.tableName}）
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button variant="outline" onClick={() => setFormMode({ type: 'create' })}>
          <PlusIcon />
          行を追加
        </Button>
      </div>

      {mutationError && (
        <p role="alert" className="text-destructive text-sm">
          操作できませんでした: {mutationError.message}
        </p>
      )}

      {formMode && (
        <RowForm
          key={formMode.type === 'create' ? 'create' : primaryKeyId(definition, formMode.row)}
          definition={definition}
          mode={formMode}
          initialInputs={
            formMode.type === 'create'
              ? initialInputs(definition)
              : Object.fromEntries(
                  formColumns(definition).map((column) => [
                    column.name,
                    toInputValue(formMode.row[column.name]),
                  ]),
                )
          }
          isSaving={create.isPending || update.isPending}
          onCancel={() => setFormMode(null)}
          onSubmit={(row) => {
            const onSuccess = () => setFormMode(null)
            if (formMode.type === 'create') {
              create.mutate({ tableName, row }, { onSuccess })
            } else if (Object.keys(row).length > 0) {
              update.mutate(
                { tableName, key: primaryKeyOf(definition, formMode.row), changes: row },
                { onSuccess },
              )
            } else {
              // 変更した列がなければ送信せずに閉じる。
              onSuccess()
            }
          }}
        />
      )}

      {/* 選んだテーブルの行の一覧 */}
      {rows.isPending ? (
        <p className="text-sm">読み込み中...</p>
      ) : rows.isError ? (
        <p role="alert" className="text-destructive text-sm">
          行を取得できませんでした: {rows.error.message}
        </p>
      ) : (
        <rowTable.DataTable
          key={tableName}
          data={entries}
          columns={columns}
          getRowId={(entry) => primaryKeyId(definition, entry.row)}
          capabilities={rowCapabilities}
          meta={{
            isBusy: rows.isPlaceholderData || remove.isPending,
            onEdit: (row) => setFormMode({ type: 'update', row }),
            onRemove: (row) => remove.mutate({ tableName, key: primaryKeyOf(definition, row) }),
          }}
          label={`${definition.displayName}の行`}
          initialLayout={{ heightStrategy: 'content' }}
        />
      )}
    </section>
  )
}

/**
 * テーブル定義から一覧の列を作る。参照先のラベルがある列は値にラベルを添え、最後に操作列を置く。
 * @param definition - 一覧に表示するテーブルの定義
 * @returns DataTable へ渡す列
 */
function createRowColumns(definition: TableDefinition) {
  const column = rowTable.createDataTableColumnHelper<RowEntry>()

  return column.columns([
    ...definition.columns.map((tableColumn) =>
      column.accessor((entry) => entry.row[tableColumn.name] ?? null, {
        id: tableColumn.name,
        header: tableColumn.name,
        cell: ({ getValue, row }) => (
          <CellText value={getValue()} label={row.original.labels[tableColumn.name] ?? null} />
        ),
      }),
    ),
    column.display({
      id: 'actions',
      header: '操作',
      size: 120,
      meta: { label: '操作' },
      cell: ({ row, table }) => {
        const { isBusy, onEdit, onRemove } = rowTable.getMeta(table)
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => onEdit(row.original.row)}
              aria-label="行を更新"
            >
              <PencilIcon />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isBusy}
              onClick={() => onRemove(row.original.row)}
              aria-label="行を削除"
            >
              <Trash2Icon />
            </Button>
          </div>
        )
      },
    }),
  ])
}

/** セルの値。NULL は値と区別できるように示し、参照先のラベルがあれば添える。 */
function CellText({ value, label }: { value: unknown; label: string | null }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">NULL</span>
  }
  return (
    <span className="font-mono">
      {String(value)}
      {label && <span className="text-muted-foreground ml-1 font-sans">（{label}）</span>}
    </span>
  )
}
