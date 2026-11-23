import { z } from 'zod'

import { runInTransaction, runWithRollback } from '@repo/sqlite'
import type { Database } from '@repo/sqlite'

import { assertConfirmationSnapshotOperation } from './confirmation-snapshot'
import type {
  SQLiteTableEditorPreparedTable,
  SQLiteTableEditorRow,
  SQLiteTableEditorRowLabels,
  SQLiteTableEditorTableDefinition,
  SQLiteTableEditorValue,
} from './models'

const SQLiteTableEditorBatchUpsertInputSchema = z
  .object({
    tableName: z.string().min(1),
    rows: z.array(z.record(z.string(), z.unknown())).min(1),
  })
  .strict()

const SQLiteTableEditorApplyBatchUpsertInputSchema = SQLiteTableEditorBatchUpsertInputSchema.extend(
  {
    confirmationSnapshot: z.string().min(1),
  },
)

export type SQLiteTableEditorBatchUpsertInput<TTableName extends string = string> = {
  tableName: TTableName
  rows: Array<Record<string, unknown>>
}

export type SQLiteTableEditorApplyBatchUpsertInput<TTableName extends string = string> =
  SQLiteTableEditorBatchUpsertInput<TTableName> & {
    confirmationSnapshot: SQLiteTableEditorBatchUpsertConfirmationSnapshot
  }

export type SQLiteTableEditorBatchUpsertConfirmationSnapshot = string & {
  readonly __sqliteTableEditorBatchUpsertConfirmationSnapshot: unique symbol
}

export function parseSQLiteTableEditorBatchUpsertConfirmationSnapshot(
  value: string,
): SQLiteTableEditorBatchUpsertConfirmationSnapshot {
  assertConfirmationSnapshotOperation(value, 'upsert')
  return value as SQLiteTableEditorBatchUpsertConfirmationSnapshot
}

export type SQLiteTableEditorBatchUpsertItemStatus = 'add' | 'update' | 'unchanged' | 'error'

export type SQLiteTableEditorBatchUpsertChange = {
  columnName: string
  before: SQLiteTableEditorValue
  after: SQLiteTableEditorValue
}

export type SQLiteTableEditorBatchUpsertPreviewItem = {
  rowNumber: number
  key: SQLiteTableEditorRow | null
  status: SQLiteTableEditorBatchUpsertItemStatus
  before: SQLiteTableEditorRow | null
  beforeLabels: SQLiteTableEditorRowLabels | null
  after: SQLiteTableEditorRow | null
  afterLabels: SQLiteTableEditorRowLabels | null
  changes: SQLiteTableEditorBatchUpsertChange[]
  errors: string[]
}

export type SQLiteTableEditorBatchUpsertPreview<TTableName extends string = string> = {
  tableName: TTableName
  summary: {
    total: number
    add: number
    update: number
    unchanged: number
    remove: 0
    error: number
  }
  items: SQLiteTableEditorBatchUpsertPreviewItem[]
  applicable: boolean
  confirmationSnapshot: SQLiteTableEditorBatchUpsertConfirmationSnapshot | null
}

export type SQLiteTableEditorBatchUpsertResult<TTableName extends string = string> = {
  tableName: TTableName
  added: number
  updated: number
}

/** metadataとeditor設定に従い、一括追加・更新の差分をDB変更なしで組み立てる。 */
export function previewSQLiteTableBatchUpsert<TTableName extends string>(
  database: Database,
  preparedTable: SQLiteTableEditorPreparedTable<TTableName>,
  input: SQLiteTableEditorBatchUpsertInput<TTableName>,
): SQLiteTableEditorBatchUpsertPreview<TTableName> {
  const parsed = SQLiteTableEditorBatchUpsertInputSchema.parse(input)
  const rows = parsed.rows
  const { definition } = preparedTable
  const items = rows.map((row, index) =>
    validateRow(row, index + 1, definition, preparedTable.columnCodecs),
  )

  addDuplicateKeyErrors(
    items,
    definition.primaryKey,
    `主キーが入力内で重複しています: ${definition.primaryKey.join(', ')}`,
    false,
  )

  const itemsWithKeys = items.filter(
    (item): item is SQLiteTableEditorBatchUpsertPreviewItem & { key: SQLiteTableEditorRow } =>
      item.key !== null,
  )
  const existingRows = preparedTable.findRowsByKeys(itemsWithKeys.map(({ key }) => key))
  const existingByKey = new Map(
    existingRows.map((row) => [serializeKey(definition.primaryKey, row), row]),
  )

  for (const item of itemsWithKeys) {
    const before = existingByKey.get(serializeKey(definition.primaryKey, item.key)) ?? null
    item.before = before
    if (item.errors.length > 0 || item.after === null) continue

    if (before === null) {
      addMissingInsertColumnErrors(item, definition)
      if (item.errors.length > 0) continue
      item.status = 'add'
      item.changes = Object.entries(item.after).map(([columnName, after]) => ({
        columnName,
        before: null,
        after,
      }))
      continue
    }

    item.after = { ...before, ...item.after }
    item.changes = Object.entries(item.after)
      .filter(([columnName, value]) => before[columnName] !== value)
      .map(([columnName, after]) => ({ columnName, before: before[columnName] ?? null, after }))
    item.status = item.changes.length === 0 ? 'unchanged' : 'update'
  }

  for (const { columns } of definition.uniqueKeys) {
    addDuplicateKeyErrors(
      items,
      columns,
      `一意制約の値が入力内で重複しています: ${columns.join(', ')}`,
      true,
    )
  }

  populateLabels(preparedTable, items)
  if (items.every(({ errors }) => errors.length === 0)) {
    verifyWritePlan(database, preparedTable, items)
  }
  for (const item of items) {
    if (item.errors.length > 0) item.status = 'error'
  }

  const summary = {
    total: items.length,
    add: items.filter(({ status }) => status === 'add').length,
    update: items.filter(({ status }) => status === 'update').length,
    unchanged: items.filter(({ status }) => status === 'unchanged').length,
    remove: 0 as const,
    error: items.filter(({ status }) => status === 'error').length,
  }
  const applicable = summary.error === 0 && summary.add + summary.update > 0
  return {
    tableName: input.tableName,
    summary,
    items,
    applicable,
    confirmationSnapshot: applicable ? createConfirmationSnapshot(rows, items) : null,
  }
}

/** preview済みの一括追加・更新計画を再検証し、一つのtransactionで適用する。 */
export function applySQLiteTableBatchUpsert<TTableName extends string>(
  database: Database,
  preparedTable: SQLiteTableEditorPreparedTable<TTableName>,
  input: SQLiteTableEditorApplyBatchUpsertInput<TTableName>,
): SQLiteTableEditorBatchUpsertResult<TTableName> {
  const parsed = SQLiteTableEditorApplyBatchUpsertInputSchema.parse(input)
  return runInTransaction(database, () => {
    const currentPreview = previewSQLiteTableBatchUpsert(database, preparedTable, {
      tableName: input.tableName,
      rows: parsed.rows,
    })
    if (
      !currentPreview.applicable ||
      currentPreview.confirmationSnapshot !== parsed.confirmationSnapshot
    ) {
      throw new Error(
        '確認後に入力またはデータベースの状態が変わりました。差分を再確認してください。',
      )
    }

    for (const item of currentPreview.items) applyPreviewItem(preparedTable, item)
    return {
      tableName: input.tableName,
      added: currentPreview.summary.add,
      updated: currentPreview.summary.update,
    }
  })
}

function validateRow<TTableName extends string>(
  row: Record<string, unknown>,
  rowNumber: number,
  definition: SQLiteTableEditorTableDefinition<TTableName>,
  columnCodecs: SQLiteTableEditorPreparedTable<TTableName>['columnCodecs'],
): SQLiteTableEditorBatchUpsertPreviewItem {
  const errors: string[] = []
  const knownColumns = new Set(definition.columns.map(({ name }) => name))
  for (const columnName of Object.keys(row)) {
    if (!knownColumns.has(columnName)) errors.push(`存在しないカラムです: ${columnName}`)
  }

  const normalized: SQLiteTableEditorRow = {}
  for (const column of definition.columns) {
    if (!Object.hasOwn(row, column.name)) continue
    const value = row[column.name]
    const codec = columnCodecs[column.name]
    if (value === null) {
      if (column.notNull) errors.push(`nullを指定できないカラムです: ${column.name}`)
      normalized[column.name] = null
    } else if (codec) {
      try {
        normalized[column.name] = codec.parseExternal(value)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `不正な値です: ${column.name}`)
      }
    } else if (column.dataType.toUpperCase().includes('INT')) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
        errors.push(`安全な整数を指定してください: ${column.name}`)
      } else normalized[column.name] = value
    } else if (column.dataType.toUpperCase().includes('TEXT')) {
      if (typeof value !== 'string') errors.push(`文字列を指定してください: ${column.name}`)
      else normalized[column.name] = value
    } else if (typeof value === 'string' || typeof value === 'number') {
      normalized[column.name] = value
    } else {
      errors.push(`不正な値です: ${column.name}`)
    }
  }

  for (const columnName of definition.primaryKey) {
    if (!Object.hasOwn(normalized, columnName) || normalized[columnName] === null) {
      errors.push(`主キーカラムを指定してください: ${columnName}`)
    }
  }
  const key = Object.fromEntries(
    definition.primaryKey
      .filter((columnName) => Object.hasOwn(normalized, columnName))
      .map((columnName) => [columnName, normalized[columnName] ?? null]),
  )
  return {
    rowNumber,
    key:
      Object.keys(key).length === definition.primaryKey.length &&
      Object.values(key).every((value) => value !== null)
        ? key
        : null,
    status: errors.length > 0 ? 'error' : 'unchanged',
    before: null,
    beforeLabels: null,
    after: normalized,
    afterLabels: null,
    changes: [],
    errors,
  }
}

function addMissingInsertColumnErrors<TTableName extends string>(
  item: SQLiteTableEditorBatchUpsertPreviewItem,
  definition: SQLiteTableEditorTableDefinition<TTableName>,
): void {
  for (const column of definition.columns) {
    if (
      column.notNull &&
      column.defaultValue === null &&
      !Object.hasOwn(item.after ?? {}, column.name)
    ) {
      item.errors.push(`新規行に必須のカラムを指定してください: ${column.name}`)
    }
  }
}

function addDuplicateKeyErrors(
  items: SQLiteTableEditorBatchUpsertPreviewItem[],
  columns: string[],
  message: string,
  allowMultipleNulls: boolean,
): void {
  const groups = new Map<string, SQLiteTableEditorBatchUpsertPreviewItem[]>()
  for (const item of items) {
    if (item.after === null || columns.some((column) => !Object.hasOwn(item.after!, column)))
      continue
    const values = columns.map((column) => item.after![column] ?? null)
    if (allowMultipleNulls && values.some((value) => value === null)) continue
    const key = JSON.stringify(values)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  for (const group of groups.values()) {
    if (group.length > 1) for (const item of group) item.errors.push(message)
  }
}

function populateLabels<TTableName extends string>(
  preparedTable: SQLiteTableEditorPreparedTable<TTableName>,
  items: SQLiteTableEditorBatchUpsertPreviewItem[],
): void {
  const beforeItems = items.filter(
    (item): item is SQLiteTableEditorBatchUpsertPreviewItem & { before: SQLiteTableEditorRow } =>
      item.before !== null,
  )
  const beforeLabels = preparedTable.listRowLabels(beforeItems.map(({ before }) => before))
  beforeItems.forEach((item, index) => {
    item.beforeLabels = beforeLabels[index] ?? {}
  })

  const afterItems = items.filter(
    (item): item is SQLiteTableEditorBatchUpsertPreviewItem & { after: SQLiteTableEditorRow } =>
      item.after !== null,
  )
  const afterLabels = preparedTable.listRowLabels(afterItems.map(({ after }) => after))
  afterItems.forEach((item, index) => {
    item.afterLabels = afterLabels[index] ?? {}
  })
}

function verifyWritePlan<TTableName extends string>(
  database: Database,
  preparedTable: SQLiteTableEditorPreparedTable<TTableName>,
  items: SQLiteTableEditorBatchUpsertPreviewItem[],
): void {
  let planFailed = false
  runWithRollback(database, () => {
    let currentItem: SQLiteTableEditorBatchUpsertPreviewItem | undefined
    try {
      for (const item of items) {
        currentItem = item
        applyPreviewItem(preparedTable, item)
      }
    } catch (error) {
      planFailed = true
      if (currentItem) currentItem.errors.push(toErrorMessage(error))
    }
  })

  if (!planFailed) return
  for (const item of items) {
    if (item.errors.length > 0 || (item.status !== 'add' && item.status !== 'update')) continue
    runWithRollback(database, () => {
      try {
        applyPreviewItem(preparedTable, item)
      } catch (error) {
        item.errors.push(toErrorMessage(error))
      }
    })
  }
}

function applyPreviewItem<TTableName extends string>(
  preparedTable: SQLiteTableEditorPreparedTable<TTableName>,
  item: SQLiteTableEditorBatchUpsertPreviewItem,
): void {
  if (item.status === 'add') {
    preparedTable.createRowInTransaction(item.after!)
  } else if (item.status === 'update') {
    preparedTable.updateRowInTransaction(
      item.key!,
      Object.fromEntries(item.changes.map(({ columnName, after }) => [columnName, after])),
    )
  }
}

function serializeKey(columns: string[], row: SQLiteTableEditorRow): string {
  return JSON.stringify(columns.map((column) => row[column] ?? null))
}

function createConfirmationSnapshot(
  rows: Array<Record<string, unknown>>,
  items: SQLiteTableEditorBatchUpsertPreviewItem[],
): SQLiteTableEditorBatchUpsertConfirmationSnapshot {
  return stableStringify({
    operation: 'upsert',
    rows,
    items,
  }) as SQLiteTableEditorBatchUpsertConfirmationSnapshot
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
