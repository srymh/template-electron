import { z } from 'zod'

import { runInTransaction } from '@repo/sqlite'
import type { Database } from '@repo/sqlite'

import { applySQLiteTableBatchDelete, previewSQLiteTableBatchDelete } from './batch-delete'
import type {
  SQLiteTableEditorApplyBatchDeleteInput,
  SQLiteTableEditorBatchDeleteInput,
  SQLiteTableEditorBatchDeletePreview,
  SQLiteTableEditorBatchDeleteResult,
} from './batch-delete'
import { applySQLiteTableBatchUpsert, previewSQLiteTableBatchUpsert } from './batch-upsert'
import type {
  SQLiteTableEditorApplyBatchUpsertInput,
  SQLiteTableEditorBatchUpsertInput,
  SQLiteTableEditorBatchUpsertPreview,
  SQLiteTableEditorBatchUpsertResult,
} from './batch-upsert'
import type {
  SQLiteTableEditorEditableColumnConfig,
  SQLiteTableEditorReferenceLabelConfig,
  SQLiteTableEditorRegistry,
} from './config'
import {
  SQLiteTableEditorCreateRowInputSchema,
  SQLiteTableEditorListRowsInputSchema,
  SQLiteTableEditorRowSchema,
  SQLiteTableEditorValueSchema,
  SQLiteTableEditorRemoveRowInputSchema,
  SQLiteTableEditorUpdateRowInputSchema,
} from './models'
import type {
  SQLiteTableEditorCreateRowInput,
  SQLiteTableEditorListRowsInput,
  SQLiteTableEditorAllowedValueOption,
  SQLiteTableEditorColumn,
  SQLiteTableEditorColumnCodec,
  SQLiteTableEditorCreateResult,
  SQLiteTableEditorTableDefinition,
  SQLiteTableEditorForeignKey,
  SQLiteTableEditorFindRowsByKeysInput,
  SQLiteTableEditorPreparedTable,
  SQLiteTableEditorRemoveResult,
  SQLiteTableEditorRow,
  SQLiteTableEditorRowLabels,
  SQLiteTableEditorRowsResult,
  SQLiteTableEditorUpdateResult,
  SQLiteTableEditorValue,
  SQLiteTableEditorRemoveRowInput,
  SQLiteTableEditorUpdateRowInput,
} from './models'

const TableInfoRowSchema = z.object({
  name: z.string(),
  dataType: z.string(),
  notNull: z.union([z.literal(0), z.literal(1)]),
  defaultValue: z.string().nullable(),
  primaryKeyOrder: z.number().int().nonnegative(),
})
const ForeignKeyRowSchema = z.object({
  id: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
  referencedTable: z.string(),
  fromColumn: z.string(),
  referencedColumn: z.string(),
  onUpdate: z.string(),
  onDelete: z.string(),
})
const SchemaRowSchema = z.object({ schemaSql: z.string() })
const UniqueIndexRowSchema = z.object({ indexName: z.string() })
const IndexColumnRowSchema = z.object({ columnName: z.string() })
const CountRowSchema = z.object({ total: z.number().int().nonnegative() })
const ReferenceOptionRowSchema = z.object({
  value: SQLiteTableEditorValueSchema,
  label: z.string().nullable(),
})
const ReferenceLabelRowSchema = z.object({ label: z.string().nullable() })

export type SQLiteTableEditor<TTableName extends string> = {
  listTables: () => SQLiteTableEditorTableDefinition<TTableName>[]
  listRows: (
    input: SQLiteTableEditorListRowsInput<TTableName>,
  ) => SQLiteTableEditorRowsResult<TTableName>
  createRow: (
    input: SQLiteTableEditorCreateRowInput<TTableName>,
  ) => SQLiteTableEditorCreateResult<TTableName>
  updateRow: (
    input: SQLiteTableEditorUpdateRowInput<TTableName>,
  ) => SQLiteTableEditorUpdateResult<TTableName>
  removeRow: (
    input: SQLiteTableEditorRemoveRowInput<TTableName>,
  ) => SQLiteTableEditorRemoveResult<TTableName>
  previewBatchUpsert: <TBatchTableName extends TTableName>(
    input: SQLiteTableEditorBatchUpsertInput<TBatchTableName>,
  ) => SQLiteTableEditorBatchUpsertPreview<TBatchTableName>
  applyBatchUpsert: <TBatchTableName extends TTableName>(
    input: SQLiteTableEditorApplyBatchUpsertInput<TBatchTableName>,
  ) => SQLiteTableEditorBatchUpsertResult<TBatchTableName>
  previewBatchDelete: <TBatchTableName extends TTableName>(
    input: SQLiteTableEditorBatchDeleteInput<TBatchTableName>,
  ) => SQLiteTableEditorBatchDeletePreview<TBatchTableName>
  applyBatchDelete: <TBatchTableName extends TTableName>(
    input: SQLiteTableEditorApplyBatchDeleteInput<TBatchTableName>,
  ) => SQLiteTableEditorBatchDeleteResult<TBatchTableName>
  prepareTable: (tableName: TTableName) => SQLiteTableEditorPreparedTable<TTableName>
}

/** 借用した同期接続に、registryで許可されたテーブルの参照・編集操作を組み立てる。 */
export function createSQLiteTableEditor<TTableName extends string>(
  database: Database,
  registry: SQLiteTableEditorRegistry<TTableName>,
): SQLiteTableEditor<TTableName> {
  // 許可済みテーブルのmetadataと、transactionを所有しない低水準操作を組み立てる。
  const findDefinition = (tableName: TTableName): SQLiteTableEditorTableDefinition<TTableName> => {
    const definition = listSQLiteTables(database, registry).find(
      ({ tableName: allowedTableName }) => allowedTableName === tableName,
    )
    if (!definition) throw new Error(`許可されていないテーブルです: ${tableName}`)
    return definition
  }

  const prepareTable = (tableName: TTableName): SQLiteTableEditorPreparedTable<TTableName> => {
    const definition = findDefinition(tableName)
    const columnCodecs = registry.getConfig(tableName).columnCodecs ?? {}
    const findPreparedDefinition = () => definition
    return {
      definition,
      columnCodecs,
      findRowsByKeys: (keys) =>
        findSQLiteTableRowsByKeys(database, findPreparedDefinition, columnCodecs, {
          tableName,
          keys,
        }),
      listRowLabels: (rows) =>
        listSQLiteTableRowLabels(
          database,
          registry.getConfig(tableName).referenceLabels ?? {},
          rows,
        ),
      createRowInTransaction: (row) =>
        createSQLiteTableRow(database, findPreparedDefinition, columnCodecs, { tableName, row }),
      updateRowInTransaction: (key, changes) =>
        updateSQLiteTableRow(
          database,
          findPreparedDefinition,
          columnCodecs,
          { tableName, key, changes },
          false,
        ),
      removeRowInTransaction: (key) =>
        removeSQLiteTableRow(
          database,
          findPreparedDefinition,
          columnCodecs,
          { tableName, key },
          false,
        ),
    }
  }

  // 一括操作の許可はregistryで確認し、実行の仕組みへ渡す。
  const prepareBatchUpsertTable = (untrustedTableName: string) => {
    const tableName = validateTableName(registry, untrustedTableName)
    if (!registry.getConfig(tableName).allowBatchUpsert) {
      throw new Error(`一括追加・更新を許可されていないテーブルです: ${tableName}`)
    }
    return prepareTable(tableName)
  }

  const prepareBatchDeleteTable = (untrustedTableName: string) => {
    const tableName = validateTableName(registry, untrustedTableName)
    if (!registry.getConfig(tableName).allowBatchDelete) {
      throw new Error(`一括削除を許可されていないテーブルです: ${tableName}`)
    }
    return prepareTable(tableName)
  }

  // 公開操作を接続へ結び付け、書き込みでは結果取得までをtransaction内に収める。
  return {
    listTables: () => listSQLiteTables(database, registry),
    listRows: (input) => listSQLiteTableRows(database, registry, findDefinition, input),
    createRow: (input) =>
      runInTransaction(database, () =>
        createSQLiteTableRow(
          database,
          findDefinition,
          registry.getConfig(input.tableName).columnCodecs ?? {},
          input,
        ),
      ),
    updateRow: (input) =>
      updateSQLiteTableRow(
        database,
        findDefinition,
        registry.getConfig(input.tableName).columnCodecs ?? {},
        input,
      ),
    removeRow: (input) =>
      removeSQLiteTableRow(
        database,
        findDefinition,
        registry.getConfig(input.tableName).columnCodecs ?? {},
        input,
      ),
    previewBatchUpsert: <TBatchTableName extends TTableName>(
      input: SQLiteTableEditorBatchUpsertInput<TBatchTableName>,
    ) =>
      previewSQLiteTableBatchUpsert(
        database,
        prepareBatchUpsertTable(input.tableName) as SQLiteTableEditorPreparedTable<TBatchTableName>,
        input,
      ),
    applyBatchUpsert: <TBatchTableName extends TTableName>(
      input: SQLiteTableEditorApplyBatchUpsertInput<TBatchTableName>,
    ) =>
      applySQLiteTableBatchUpsert(
        database,
        prepareBatchUpsertTable(input.tableName) as SQLiteTableEditorPreparedTable<TBatchTableName>,
        input,
      ),
    previewBatchDelete: <TBatchTableName extends TTableName>(
      input: SQLiteTableEditorBatchDeleteInput<TBatchTableName>,
    ) =>
      previewSQLiteTableBatchDelete(
        database,
        prepareBatchDeleteTable(input.tableName) as SQLiteTableEditorPreparedTable<TBatchTableName>,
        input,
      ),
    applyBatchDelete: <TBatchTableName extends TTableName>(
      input: SQLiteTableEditorApplyBatchDeleteInput<TBatchTableName>,
    ) =>
      applySQLiteTableBatchDelete(
        database,
        prepareBatchDeleteTable(input.tableName) as SQLiteTableEditorPreparedTable<TBatchTableName>,
        input,
      ),
    prepareTable,
  }
}

/** allowlist登録されたSQLiteテーブルの定義をmetadataから取得する。 */
function listSQLiteTables<TTableName extends string>(
  database: Database,
  registry: SQLiteTableEditorRegistry<TTableName>,
): SQLiteTableEditorTableDefinition<TTableName>[] {
  return registry.tableNames.map((tableName) => {
    const config = registry.getConfig(tableName)
    const tableInfo = TableInfoRowSchema.array().parse(
      database.query(`
      SELECT
        name,
        type AS "dataType",
        "notnull" AS "notNull",
        dflt_value AS "defaultValue",
        pk AS "primaryKeyOrder"
      FROM pragma_table_info('${tableName}')
      ORDER BY cid
    `),
    )
    const columns: SQLiteTableEditorColumn[] = tableInfo.map((column) => {
      const editable = Object.hasOwn(config.editableColumns, column.name)
      const editableColumnConfig = editable ? config.editableColumns[column.name] : undefined
      const { allowedValueOptions, allowedValues } = resolveEditableColumnConfig(
        database,
        editableColumnConfig,
      )

      return {
        name: column.name,
        dataType: column.dataType,
        notNull: column.notNull === 1,
        defaultValue: column.defaultValue,
        primaryKeyOrder: column.primaryKeyOrder > 0 ? column.primaryKeyOrder : null,
        editable,
        allowedValues,
        allowedValueOptions,
      }
    })
    const foreignKeys = ForeignKeyRowSchema.array().parse(
      database.query(`
      SELECT
        id,
        seq AS sequence,
        "table" AS "referencedTable",
        "from" AS "fromColumn",
        "to" AS "referencedColumn",
        on_update AS "onUpdate",
        on_delete AS "onDelete"
      FROM pragma_foreign_key_list('${tableName}')
      ORDER BY id, seq
    `),
    ) satisfies SQLiteTableEditorForeignKey[]
    const uniqueKeys = UniqueIndexRowSchema.array()
      .parse(
        database.query(
          `SELECT name AS "indexName"
         FROM pragma_index_list(?)
         WHERE "unique" = 1 AND origin <> 'pk' AND partial = 0
         ORDER BY seq`,
          [tableName],
        ),
      )
      .map(({ indexName }) => ({
        columns: IndexColumnRowSchema.array()
          .parse(
            database.query(
              `SELECT name AS "columnName"
             FROM pragma_index_info(?)
             ORDER BY seqno`,
              [indexName],
            ),
          )
          .map(({ columnName }) => columnName),
      }))
    const schema = SchemaRowSchema.optional().parse(
      database.get(
        `SELECT sql AS "schemaSql" FROM sqlite_master WHERE type = 'table' AND name = ?`,
        [tableName],
      ),
    )
    if (!schema) throw new Error(`テーブル定義を取得できませんでした: ${tableName}`)

    return {
      tableName,
      displayName: config.displayName,
      columns,
      primaryKey: columns
        .filter((column) => column.primaryKeyOrder !== null)
        .sort((left, right) => left.primaryKeyOrder! - right.primaryKeyOrder!)
        .map((column) => column.name),
      uniqueKeys,
      foreignKeys,
      schemaSql: schema.schemaSql,
    }
  })
}

function listSQLiteTableRows<TTableName extends string>(
  database: Database,
  registry: SQLiteTableEditorRegistry<TTableName>,
  findDefinition: (tableName: TTableName) => SQLiteTableEditorTableDefinition<TTableName>,
  input: SQLiteTableEditorListRowsInput<TTableName>,
): SQLiteTableEditorRowsResult<TTableName> {
  const validatedInput = SQLiteTableEditorListRowsInputSchema.parse(input)
  const tableName = validateTableName(registry, validatedInput.tableName)
  const definition = findDefinition(tableName)
  const columnCodecs = registry.getConfig(tableName).columnCodecs ?? {}

  const count = CountRowSchema.optional().parse(
    database.get(`SELECT COUNT(*) AS total FROM "${definition.tableName}"`),
  )
  if (!count) throw new Error(`行数を取得できませんでした: ${definition.tableName}`)
  if (validatedInput.range.type === 'all' && count.total > validatedInput.range.maxRows) {
    throw new Error(
      `全件取得の上限を超えています: ${definition.tableName} (${count.total}/${validatedInput.range.maxRows})`,
    )
  }

  const orderBy = definition.primaryKey.map((column) => `"${column}"`).join(', ')
  const rows =
    validatedInput.range.type === 'page'
      ? database.query(
          `SELECT * FROM "${definition.tableName}"
           ORDER BY ${orderBy}
           LIMIT ? OFFSET ?`,
          [validatedInput.range.limit, validatedInput.range.offset],
        )
      : database.query(`SELECT * FROM "${definition.tableName}" ORDER BY ${orderBy}`)
  const validatedRows = rows.map((row) => decodeDatabaseRow(row, columnCodecs))

  return {
    tableName: definition.tableName,
    rows: validatedRows,
    rowLabels: listSQLiteTableRowLabels(
      database,
      registry.getConfig(definition.tableName).referenceLabels ?? {},
      validatedRows,
    ),
    total: count.total,
    range:
      validatedInput.range.type === 'page'
        ? {
            type: 'page',
            limit: validatedInput.range.limit,
            offset: validatedInput.range.offset,
          }
        : { type: 'all' },
  }
}

function createSQLiteTableRow<TTableName extends string>(
  database: Database,
  findDefinition: (tableName: TTableName) => SQLiteTableEditorTableDefinition<TTableName>,
  columnCodecs: Readonly<Record<string, SQLiteTableEditorColumnCodec>>,
  input: SQLiteTableEditorCreateRowInput<TTableName>,
): SQLiteTableEditorCreateResult<TTableName> {
  const validatedInput = SQLiteTableEditorCreateRowInputSchema.parse(input)
  const definition = findDefinition(validatedInput.tableName as TTableName)

  const columnNames = Object.keys(validatedInput.row)
  if (columnNames.length === 0) throw new Error('追加する行の値を指定してください。')

  const validColumns = new Set(definition.columns.map(({ name }) => name))
  const invalidColumn = columnNames.find((column) => !validColumns.has(column))
  if (invalidColumn) throw new Error(`存在しないカラムです: ${invalidColumn}`)

  const keyColumns = Object.keys(validatedInput.row)
  if (
    definition.primaryKey.some((column) => !keyColumns.includes(column)) ||
    definition.primaryKey.some((column) => validatedInput.row[column] === null)
  ) {
    throw new Error(`主キーをすべて指定してください: ${definition.primaryKey.join(', ')}`)
  }

  validateAllowedValues(definition, validatedInput.row)

  const columnSql = columnNames.map((column) => `"${column}"`).join(', ')
  const valueSql = columnNames.map(() => '?').join(', ')
  const values = columnNames.map((column) =>
    encodeDatabaseValue(column, validatedInput.row[column] ?? null, columnCodecs),
  )
  database.run(`INSERT INTO "${definition.tableName}" (${columnSql}) VALUES (${valueSql})`, values)

  const whereSql = definition.primaryKey.map((column) => `"${column}" = ?`).join(' AND ')
  const keyValues = definition.primaryKey.map((column) =>
    encodeDatabaseValue(column, validatedInput.row[column] ?? null, columnCodecs),
  )
  const row = database.get(`SELECT * FROM "${definition.tableName}" WHERE ${whereSql}`, keyValues)
  if (!row) throw new Error('追加した行を取得できませんでした。')

  return {
    tableName: definition.tableName,
    row: decodeDatabaseRow(row, columnCodecs),
  }
}

function updateSQLiteTableRow<TTableName extends string>(
  database: Database,
  findDefinition: (tableName: TTableName) => SQLiteTableEditorTableDefinition<TTableName>,
  columnCodecs: Readonly<Record<string, SQLiteTableEditorColumnCodec>>,
  input: SQLiteTableEditorUpdateRowInput<TTableName>,
  ownsTransaction = true,
): SQLiteTableEditorUpdateResult<TTableName> {
  const validatedInput = SQLiteTableEditorUpdateRowInputSchema.parse(input)
  const definition = findDefinition(validatedInput.tableName as TTableName)

  const keyColumns = Object.keys(validatedInput.key)
  if (
    keyColumns.length !== definition.primaryKey.length ||
    definition.primaryKey.some((column) => !keyColumns.includes(column))
  ) {
    throw new Error(`主キーをすべて指定してください: ${definition.primaryKey.join(', ')}`)
  }

  const changeColumns = Object.keys(validatedInput.changes)
  if (changeColumns.length === 0) throw new Error('更新するカラムを指定してください。')

  const editableColumns = new Set(
    definition.columns.filter(({ editable }) => editable).map(({ name }) => name),
  )
  const invalidColumn = changeColumns.find((column) => !editableColumns.has(column))
  if (invalidColumn) throw new Error(`更新を許可されていないカラムです: ${invalidColumn}`)

  validateAllowedValues(definition, validatedInput.changes)

  const whereSql = definition.primaryKey.map((column) => `"${column}" = ?`).join(' AND ')
  const keyValues = definition.primaryKey.map((column) =>
    encodeDatabaseValue(column, validatedInput.key[column] ?? null, columnCodecs),
  )

  const operation = () => {
    const before = findRowByKey(database, definition.tableName, whereSql, keyValues, columnCodecs)
    if (!before) throw new Error('更新対象の行が見つかりません。')

    const setSql = changeColumns.map((column) => `"${column}" = ?`).join(', ')
    const changeValues = changeColumns.map((column) =>
      encodeDatabaseValue(column, validatedInput.changes[column] ?? null, columnCodecs),
    )
    database.run(`UPDATE "${definition.tableName}" SET ${setSql} WHERE ${whereSql}`, [
      ...changeValues,
      ...keyValues,
    ])

    const after = findRowByKey(database, definition.tableName, whereSql, keyValues, columnCodecs)
    if (!after) throw new Error('更新後の行を取得できませんでした。')

    return {
      tableName: definition.tableName,
      key: validatedInput.key,
      before,
      after,
      changed: changeColumns.some((column) => before[column] !== after[column]),
    }
  }
  return ownsTransaction ? runInTransaction(database, operation) : operation()
}

function findSQLiteTableRowsByKeys<TTableName extends string>(
  database: Database,
  findDefinition: (tableName: TTableName) => SQLiteTableEditorTableDefinition<TTableName>,
  columnCodecs: Readonly<Record<string, SQLiteTableEditorColumnCodec>>,
  input: SQLiteTableEditorFindRowsByKeysInput<TTableName>,
): SQLiteTableEditorRow[] {
  const definition = findDefinition(input.tableName)
  if (input.keys.length === 0) return []

  const parametersPerKey = definition.primaryKey.length
  const chunkSize = Math.max(1, Math.floor(900 / parametersPerKey))
  const rows: SQLiteTableEditorRow[] = []

  for (let offset = 0; offset < input.keys.length; offset += chunkSize) {
    const keys = input.keys.slice(offset, offset + chunkSize)
    const values: unknown[] = []
    const predicates = keys.map((key) => {
      validateExactPrimaryKey(definition, key)
      values.push(
        ...definition.primaryKey.map((column) =>
          encodeDatabaseValue(column, key[column] ?? null, columnCodecs),
        ),
      )
      return `(${definition.primaryKey.map((column) => `"${column}" = ?`).join(' AND ')})`
    })
    const found = database.query(
      `SELECT * FROM "${definition.tableName}" WHERE ${predicates.join(' OR ')}`,
      values,
    )
    rows.push(...found.map((row) => decodeDatabaseRow(row, columnCodecs)))
  }

  return rows
}

function validateExactPrimaryKey<TTableName extends string>(
  definition: SQLiteTableEditorTableDefinition<TTableName>,
  key: SQLiteTableEditorRow,
): void {
  const keyColumns = Object.keys(key)
  if (
    keyColumns.length !== definition.primaryKey.length ||
    definition.primaryKey.some((column) => !keyColumns.includes(column))
  ) {
    throw new Error(`主キーをすべて指定してください: ${definition.primaryKey.join(', ')}`)
  }
}

function removeSQLiteTableRow<TTableName extends string>(
  database: Database,
  findDefinition: (tableName: TTableName) => SQLiteTableEditorTableDefinition<TTableName>,
  columnCodecs: Readonly<Record<string, SQLiteTableEditorColumnCodec>>,
  input: SQLiteTableEditorRemoveRowInput<TTableName>,
  ownsTransaction = true,
): SQLiteTableEditorRemoveResult<TTableName> {
  const validatedInput = SQLiteTableEditorRemoveRowInputSchema.parse(input)
  const definition = findDefinition(validatedInput.tableName as TTableName)

  const keyColumns = Object.keys(validatedInput.key)
  if (
    keyColumns.length !== definition.primaryKey.length ||
    definition.primaryKey.some((column) => !keyColumns.includes(column))
  ) {
    throw new Error(`主キーをすべて指定してください: ${definition.primaryKey.join(', ')}`)
  }

  const whereSql = definition.primaryKey.map((column) => `"${column}" = ?`).join(' AND ')
  const keyValues = definition.primaryKey.map((column) =>
    encodeDatabaseValue(column, validatedInput.key[column] ?? null, columnCodecs),
  )

  const operation = () => {
    const before = findRowByKey(database, definition.tableName, whereSql, keyValues, columnCodecs)
    if (!before) throw new Error('削除対象の行が見つかりません。')

    database.run(`DELETE FROM "${definition.tableName}" WHERE ${whereSql}`, keyValues)

    return {
      tableName: definition.tableName,
      key: validatedInput.key,
      before,
      removed:
        findRowByKey(database, definition.tableName, whereSql, keyValues, columnCodecs) ===
        undefined,
    }
  }
  return ownsTransaction ? runInTransaction(database, operation) : operation()
}

function resolveEditableColumnConfig(
  database: Database,
  editableColumnConfig: SQLiteTableEditorEditableColumnConfig | undefined,
): {
  allowedValues: SQLiteTableEditorValue[] | null
  allowedValueOptions: SQLiteTableEditorAllowedValueOption[] | null
} {
  if (editableColumnConfig === undefined || editableColumnConfig === null) {
    return { allowedValues: null, allowedValueOptions: null }
  }

  if (!('referenceOptions' in editableColumnConfig)) {
    const allowedValues = [...editableColumnConfig]
    return {
      allowedValues,
      allowedValueOptions: allowedValues.map((value) => ({ value, label: null })),
    }
  }

  const { referenceOptions } = editableColumnConfig
  const rows = ReferenceOptionRowSchema.array().parse(
    database.query(
      `SELECT "${referenceOptions.valueColumn}" AS value,
            "${referenceOptions.labelColumn}" AS label
     FROM "${referenceOptions.tableName}"
     ORDER BY "${referenceOptions.valueColumn}"`,
    ),
  )
  const allowedValueOptions: SQLiteTableEditorAllowedValueOption[] = rows.map((row) => ({
    value: row.value,
    label: row.label,
  }))
  if (referenceOptions.nullable) {
    allowedValueOptions.unshift({
      value: null,
      label: referenceOptions.nullLabel ?? null,
    })
  }

  return {
    allowedValues: allowedValueOptions.map(({ value }) => value),
    allowedValueOptions,
  }
}

function listSQLiteTableRowLabels(
  database: Database,
  referenceLabels: Readonly<Record<string, SQLiteTableEditorReferenceLabelConfig>>,
  rows: SQLiteTableEditorRow[],
): SQLiteTableEditorRowLabels[] {
  const cache = new Map<string, string | null>()
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(referenceLabels).map(([columnName, referenceLabel]) => {
        const keyColumns = referenceLabel.keyColumns ?? [
          {
            sourceColumn: columnName,
            referenceColumn: referenceLabel.valueColumn ?? columnName,
          },
        ]
        const values = keyColumns.map(({ sourceColumn }) => row[sourceColumn] ?? null)
        const cacheKey = JSON.stringify([columnName, values])
        if (!cache.has(cacheKey)) {
          cache.set(cacheKey, findReferenceLabel(database, referenceLabel, row, columnName))
        }
        return [columnName, cache.get(cacheKey) ?? null]
      }),
    ),
  )
}

function findReferenceLabel(
  database: Database,
  referenceLabel: SQLiteTableEditorReferenceLabelConfig,
  row: SQLiteTableEditorRow,
  sourceColumnName: string,
): string | null {
  const keyColumns = referenceLabel.keyColumns ?? [
    {
      sourceColumn: sourceColumnName,
      referenceColumn: referenceLabel.valueColumn ?? sourceColumnName,
    },
  ]
  const values = keyColumns.map(({ sourceColumn }) => row[sourceColumn] ?? null)
  if (values.some((value) => value === null)) return null

  const whereSql = keyColumns.map(({ referenceColumn }) => `"${referenceColumn}" = ?`).join(' AND ')
  const referenceRow = ReferenceLabelRowSchema.optional().parse(
    database.get(
      `SELECT "${referenceLabel.labelColumn}" AS label
     FROM "${referenceLabel.tableName}"
     WHERE ${whereSql}`,
      values,
    ),
  )
  if (!referenceRow) return null
  return referenceRow.label || referenceLabel.fallbackLabel || null
}

function findRowByKey(
  database: Database,
  tableName: string,
  whereSql: string,
  keyValues: unknown[],
  columnCodecs: Readonly<Record<string, SQLiteTableEditorColumnCodec>>,
): SQLiteTableEditorRow | undefined {
  const row = database.get(`SELECT * FROM "${tableName}" WHERE ${whereSql}`, keyValues)
  return row === undefined ? undefined : decodeDatabaseRow(row, columnCodecs)
}

function encodeDatabaseValue(
  columnName: string,
  value: SQLiteTableEditorValue,
  columnCodecs: Readonly<Record<string, SQLiteTableEditorColumnCodec>>,
): unknown {
  if (value === null) return null
  return columnCodecs[columnName]?.toDatabase(value) ?? value
}

function decodeDatabaseRow(
  value: unknown,
  columnCodecs: Readonly<Record<string, SQLiteTableEditorColumnCodec>>,
): SQLiteTableEditorRow {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return SQLiteTableEditorRowSchema.parse(value)
  }
  const decoded = Object.fromEntries(
    Object.entries(value).map(([columnName, columnValue]) => [
      columnName,
      columnCodecs[columnName]?.fromDatabase(columnValue) ?? columnValue,
    ]),
  )
  return SQLiteTableEditorRowSchema.parse(decoded)
}

function validateAllowedValues<TTableName extends string>(
  definition: SQLiteTableEditorTableDefinition<TTableName>,
  row: SQLiteTableEditorRow,
): void {
  for (const columnName of Object.keys(row)) {
    const column = definition.columns.find(({ name }) => name === columnName)!
    if (column.allowedValues !== null && !column.allowedValues.includes(row[columnName] ?? null)) {
      throw new Error(`許可されていない値です: ${columnName}`)
    }
  }
}

function validateTableName<TTableName extends string>(
  registry: SQLiteTableEditorRegistry<TTableName>,
  tableName: string,
): TTableName {
  if (registry.tableNames.includes(tableName as TTableName)) return tableName as TTableName
  throw new Error(`許可されていないテーブルです: ${tableName}`)
}
