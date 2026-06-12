import fs from 'node:fs'
import { createRequire } from 'node:module'

import type { DatabaseSync as NodeSqliteDatabaseSync } from 'node:sqlite'

import { createDatabase, normalizeSqliteRunResult } from './database'
import type { Database, DatabaseOpenOptions, SqliteDatabase, SqliteStatement } from './database'

const require = createRequire(import.meta.url)

type NodeSqliteModule = {
  DatabaseSync: typeof NodeSqliteDatabaseSync
}

type DriverStatement = {
  all: (...params: readonly unknown[]) => unknown[]
  get: (...params: readonly unknown[]) => unknown
  iterate: (...params: readonly unknown[]) => Iterable<unknown>
  run: (...params: readonly unknown[]) => unknown
}

export function openNodeSqliteDatabase(filePath: string, options?: DatabaseOpenOptions): Database {
  assertFileCanBeOpened(filePath, options)

  const { DatabaseSync } = loadNodeSqliteModule()
  const db = new DatabaseSync(filePath, {
    readOnly: options?.readonly,
  })

  return createDatabase(createNodeSqliteHandle(db))
}

export function createNodeSqliteHandle(db: NodeSqliteDatabaseSync): SqliteDatabase {
  return {
    prepare: (sql) => createStatement(db.prepare(sql) as unknown as DriverStatement),
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  }
}

function createStatement(stmt: DriverStatement): SqliteStatement {
  return {
    all: <T = unknown>(...params: readonly unknown[]) => stmt.all(...params) as T[],
    get: <T = unknown>(...params: readonly unknown[]) => stmt.get(...params) as T | undefined,
    iterate: <T = unknown>(...params: readonly unknown[]) => stmt.iterate(...params) as Iterable<T>,
    run: (...params: readonly unknown[]) => normalizeSqliteRunResult(stmt.run(...params)),
  }
}

function loadNodeSqliteModule(): NodeSqliteModule {
  try {
    return require('node:sqlite') as NodeSqliteModule
  } catch (error) {
    const message =
      'node:sqlite is not available in this Electron/Node runtime. Use SQLITE_DRIVER=better-sqlite3 or upgrade Electron.'

    throw new Error(message, { cause: error })
  }
}

function assertFileCanBeOpened(filePath: string, options?: DatabaseOpenOptions): void {
  if (!options?.fileMustExist || filePath === ':memory:') {
    return
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`SQLite database file does not exist: ${filePath}`)
  }
}
