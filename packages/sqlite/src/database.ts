export const SQLITE_DRIVER_NAMES = ['better-sqlite3', 'node:sqlite'] as const

export type SqliteDriverName = (typeof SQLITE_DRIVER_NAMES)[number]

export type DatabaseOpenOptions = {
  readonly?: boolean
  fileMustExist?: boolean
}

export type SqliteRunResult = {
  changes: number
  lastInsertRowid?: number | bigint
}

export type SqliteStatement = {
  all: <T = unknown>(...params: readonly unknown[]) => T[]
  get: <T = unknown>(...params: readonly unknown[]) => T | undefined
  iterate: <T = unknown>(...params: readonly unknown[]) => Iterable<T>
  run: (...params: readonly unknown[]) => SqliteRunResult
}

export type SqliteDatabase = {
  prepare: (sql: string) => SqliteStatement
  exec: (sql: string) => void
  close: () => void
}

export type SqliteDatabaseHandle = SqliteDatabase

export class Database {
  constructor(private readonly db: SqliteDatabase) {}

  query<T = unknown>(sql: string, params?: readonly unknown[]): T[] {
    const stmt = this.db.prepare(sql)
    return params ? stmt.all<T>(...params) : stmt.all<T>()
  }

  get<T = unknown>(sql: string, params?: readonly unknown[]): T | undefined {
    const stmt = this.db.prepare(sql)
    return params ? stmt.get<T>(...params) : stmt.get<T>()
  }

  iterate<T = unknown>(sql: string, params?: readonly unknown[]): Iterable<T> {
    const stmt = this.db.prepare(sql)
    return params ? stmt.iterate<T>(...params) : stmt.iterate<T>()
  }

  run(sql: string, params?: readonly unknown[]): SqliteRunResult {
    const stmt = this.db.prepare(sql)
    return params ? stmt.run(...params) : stmt.run()
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  close(): void {
    this.db.close()
  }
}

export function createDatabase(db: SqliteDatabase): Database {
  return new Database(db)
}

export function parseSqliteDriverName(value: string | undefined): SqliteDriverName | undefined {
  if (!value) {
    return undefined
  }

  if (isSqliteDriverName(value)) {
    return value
  }

  throw new Error('SQLITE_DRIVER must be "better-sqlite3" or "node:sqlite"')
}

export function isSqliteDriverName(value: string): value is SqliteDriverName {
  return SQLITE_DRIVER_NAMES.some((driverName) => driverName === value)
}

export function normalizeSqliteRunResult(result: unknown): SqliteRunResult {
  if (!isObjectRecord(result)) {
    return { changes: 0 }
  }

  const changes = typeof result.changes === 'number' ? result.changes : 0
  const lastInsertRowid = result.lastInsertRowid

  if (typeof lastInsertRowid === 'number' || typeof lastInsertRowid === 'bigint') {
    return { changes, lastInsertRowid }
  }

  return { changes }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
