export type SqliteStatement = {
  all: (...params: unknown[]) => unknown[]
  get: (...params: unknown[]) => unknown
  run: (...params: unknown[]) => unknown
}

export type SqliteDatabaseHandle = {
  prepare: (sql: string) => SqliteStatement
  exec: (sql: string) => void
  close: () => void
}

export class Database {
  constructor(private readonly db: SqliteDatabaseHandle) {}

  query<T = unknown>(sql: string, params?: readonly unknown[]): T[] {
    const stmt = this.db.prepare(sql)
    return (params ? stmt.all(...params) : stmt.all()) as T[]
  }

  get<T = unknown>(sql: string, params?: readonly unknown[]): T | undefined {
    const stmt = this.db.prepare(sql)
    return (params ? stmt.get(...params) : stmt.get()) as T | undefined
  }

  run(sql: string, params?: readonly unknown[]): void {
    const stmt = this.db.prepare(sql)
    if (params) {
      stmt.run(...params)
      return
    }

    stmt.run()
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  close(): void {
    this.db.close()
  }
}

export function createDatabase(db: SqliteDatabaseHandle): Database {
  return new Database(db)
}
