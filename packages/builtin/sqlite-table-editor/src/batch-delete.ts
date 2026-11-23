import { z } from 'zod'

import { runInTransaction, runWithRollback } from '@repo/sqlite'
import type { Database } from '@repo/sqlite'

import { assertConfirmationSnapshotOperation } from './confirmation-snapshot'
import type {
  SQLiteTableEditorPreparedTable,
  SQLiteTableEditorRow,
  SQLiteTableEditorRowLabels,
} from './models'

const SQLiteTableEditorBatchDeleteInputSchema = z
  .object({
    tableName: z.string().min(1),
    keys: z.array(z.record(z.string(), z.unknown())).min(1),
  })
  .strict()

const SQLiteTableEditorApplyBatchDeleteInputSchema = SQLiteTableEditorBatchDeleteInputSchema.extend(
  { confirmationSnapshot: z.string().min(1) },
)

export type SQLiteTableEditorBatchDeleteInput<TTableName extends string = string> = {
  tableName: TTableName
  keys: Array<Record<string, unknown>>
}

export type SQLiteTableEditorApplyBatchDeleteInput<TTableName extends string = string> =
  SQLiteTableEditorBatchDeleteInput<TTableName> & {
    confirmationSnapshot: SQLiteTableEditorBatchDeleteConfirmationSnapshot
  }

export type SQLiteTableEditorBatchDeleteConfirmationSnapshot = string & {
  readonly __sqliteTableEditorBatchDeleteConfirmationSnapshot: unique symbol
}

export function parseSQLiteTableEditorBatchDeleteConfirmationSnapshot(
  value: string,
): SQLiteTableEditorBatchDeleteConfirmationSnapshot {
  assertConfirmationSnapshotOperation(value, 'delete')
  return value as SQLiteTableEditorBatchDeleteConfirmationSnapshot
}

export type SQLiteTableEditorBatchDeleteItemStatus = 'remove' | 'error'

export type SQLiteTableEditorBatchDeletePreviewItem = {
  rowNumber: number
  key: SQLiteTableEditorRow | null
  status: SQLiteTableEditorBatchDeleteItemStatus
  before: SQLiteTableEditorRow | null
  beforeLabels: SQLiteTableEditorRowLabels | null
  after: null
  afterLabels: null
  changes: []
  errors: string[]
}

export type SQLiteTableEditorBatchDeletePreview<TTableName extends string = string> = {
  tableName: TTableName
  summary: {
    total: number
    add: 0
    update: 0
    unchanged: 0
    remove: number
    error: number
  }
  items: SQLiteTableEditorBatchDeletePreviewItem[]
  applicable: boolean
  confirmationSnapshot: SQLiteTableEditorBatchDeleteConfirmationSnapshot | null
}

export type SQLiteTableEditorBatchDeleteResult<TTableName extends string = string> = {
  tableName: TTableName
  removed: number
}

/** metadataから正規化した主キーに従い、一括削除の差分をDB変更なしで組み立てる。 */
export function previewSQLiteTableBatchDelete<TTableName extends string>(
  database: Database,
  preparedTable: SQLiteTableEditorPreparedTable<TTableName>,
  input: SQLiteTableEditorBatchDeleteInput<TTableName>,
): SQLiteTableEditorBatchDeletePreview<TTableName> {
  const parsed = SQLiteTableEditorBatchDeleteInputSchema.parse(input)
  const { definition } = preparedTable
  const items = parsed.keys.map((key, index) => validateKey(key, index + 1, preparedTable))

  const groups = new Map<string, SQLiteTableEditorBatchDeletePreviewItem[]>()
  for (const item of items) {
    if (!item.key) continue
    const serialized = serializeKey(definition.primaryKey, item.key)
    groups.set(serialized, [...(groups.get(serialized) ?? []), item])
  }
  for (const group of groups.values()) {
    if (group.length > 1) {
      for (const item of group) item.errors.push('主キーが入力内で重複しています。')
    }
  }

  const keyedItems = items.filter(
    (item): item is SQLiteTableEditorBatchDeletePreviewItem & { key: SQLiteTableEditorRow } =>
      item.key !== null,
  )
  const existingRows = preparedTable.findRowsByKeys(keyedItems.map(({ key }) => key))
  const existingByKey = new Map(
    existingRows.map((row) => [serializeKey(definition.primaryKey, row), row]),
  )
  for (const item of keyedItems) {
    item.before = existingByKey.get(serializeKey(definition.primaryKey, item.key)) ?? null
    if (!item.before) item.errors.push('削除対象の行が見つかりません。')
  }

  const rowsWithBefore = items.filter(
    (item): item is SQLiteTableEditorBatchDeletePreviewItem & { before: SQLiteTableEditorRow } =>
      item.before !== null,
  )
  const labels = preparedTable.listRowLabels(rowsWithBefore.map(({ before }) => before))
  rowsWithBefore.forEach((item, index) => {
    item.beforeLabels = labels[index] ?? {}
  })

  if (items.every(({ errors }) => errors.length === 0))
    verifyDeletePlan(database, preparedTable, items)
  for (const item of items) item.status = item.errors.length === 0 ? 'remove' : 'error'

  const summary = {
    total: items.length,
    add: 0 as const,
    update: 0 as const,
    unchanged: 0 as const,
    remove: items.filter(({ status }) => status === 'remove').length,
    error: items.filter(({ status }) => status === 'error').length,
  }
  const applicable = summary.error === 0 && summary.remove > 0
  return {
    tableName: input.tableName,
    summary,
    items,
    applicable,
    confirmationSnapshot: applicable
      ? (stableStringify({
          operation: 'delete',
          keys: parsed.keys,
          items,
        }) as SQLiteTableEditorBatchDeleteConfirmationSnapshot)
      : null,
  }
}

/** preview済みの一括削除計画を再検証し、一つのtransactionで適用する。 */
export function applySQLiteTableBatchDelete<TTableName extends string>(
  database: Database,
  preparedTable: SQLiteTableEditorPreparedTable<TTableName>,
  input: SQLiteTableEditorApplyBatchDeleteInput<TTableName>,
): SQLiteTableEditorBatchDeleteResult<TTableName> {
  const parsed = SQLiteTableEditorApplyBatchDeleteInputSchema.parse(input)
  return runInTransaction(database, () => {
    const currentPreview = previewSQLiteTableBatchDelete(database, preparedTable, {
      tableName: input.tableName,
      keys: parsed.keys,
    })
    if (
      !currentPreview.applicable ||
      currentPreview.confirmationSnapshot !== parsed.confirmationSnapshot
    ) {
      throw new Error(
        '確認後に入力またはデータベースの状態が変わりました。差分を再確認してください。',
      )
    }
    for (const item of currentPreview.items) preparedTable.removeRowInTransaction(item.key!)
    return { tableName: input.tableName, removed: currentPreview.summary.remove }
  })
}

function validateKey<TTableName extends string>(
  source: Record<string, unknown>,
  rowNumber: number,
  preparedTable: SQLiteTableEditorPreparedTable<TTableName>,
): SQLiteTableEditorBatchDeletePreviewItem {
  const { definition, columnCodecs } = preparedTable
  const errors: string[] = []
  const sourceColumns = Object.keys(source)
  for (const columnName of sourceColumns) {
    if (!definition.primaryKey.includes(columnName))
      errors.push(`主キー以外のカラムは指定できません: ${columnName}`)
  }
  const key: SQLiteTableEditorRow = {}
  for (const columnName of definition.primaryKey) {
    if (!Object.hasOwn(source, columnName) || source[columnName] === null) {
      errors.push(`主キーカラムを指定してください: ${columnName}`)
      continue
    }
    const column = definition.columns.find(({ name }) => name === columnName)!
    const value = source[columnName]
    const codec = columnCodecs[columnName]
    try {
      if (codec) key[columnName] = codec.parseExternal(value)
      else if (column.dataType.toUpperCase().includes('INT')) {
        if (typeof value !== 'number' || !Number.isSafeInteger(value))
          throw new Error(`安全な整数を指定してください: ${columnName}`)
        key[columnName] = value
      } else if (column.dataType.toUpperCase().includes('TEXT')) {
        if (typeof value !== 'string') throw new Error(`文字列を指定してください: ${columnName}`)
        key[columnName] = value
      } else if (typeof value === 'string' || typeof value === 'number') key[columnName] = value
      else throw new Error(`不正な値です: ${columnName}`)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `不正な値です: ${columnName}`)
    }
  }
  const validKey = Object.keys(key).length === definition.primaryKey.length ? key : null
  return {
    rowNumber,
    key: validKey,
    status: errors.length === 0 ? 'remove' : 'error',
    before: null,
    beforeLabels: null,
    after: null,
    afterLabels: null,
    changes: [],
    errors,
  }
}

function verifyDeletePlan<TTableName extends string>(
  database: Database,
  preparedTable: SQLiteTableEditorPreparedTable<TTableName>,
  items: SQLiteTableEditorBatchDeletePreviewItem[],
): void {
  runWithRollback(database, () => {
    let currentItem: SQLiteTableEditorBatchDeletePreviewItem | undefined
    try {
      for (const item of items) {
        currentItem = item
        preparedTable.removeRowInTransaction(item.key!)
      }
    } catch (error) {
      if (currentItem) currentItem.errors.push(toErrorMessage(error))
    }
  })
}

function serializeKey(columns: string[], row: SQLiteTableEditorRow): string {
  return JSON.stringify(columns.map((column) => row[column] ?? null))
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'SQLite制約に違反しています。'
}
