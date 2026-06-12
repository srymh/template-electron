import { createRequire } from 'node:module'

import type {
  Database as BetterSqlite3Database,
  Options as BetterSqlite3Options,
} from 'better-sqlite3'

import {
  createDatabase,
  normalizeSqliteRunResult,
  openNodeSqliteDatabase,
  parseSqliteDriverName,
} from '@repo/sqlite'
import type {
  Database,
  DatabaseOpenOptions,
  SqliteDatabase,
  SqliteDriverName,
  SqliteStatement,
} from '@repo/sqlite'

declare const __SQLITE_DRIVER__: string | undefined

const require = createRequire(import.meta.url)

export type CreateAppDatabaseOptions = DatabaseOpenOptions & {
  driver?: SqliteDriverName
}

type SqliteDriverSources = {
  driver?: SqliteDriverName
  envDriver?: string
  buildTimeDriver?: string
}

type BetterSqlite3Constructor = new (
  filePath: string,
  options?: BetterSqlite3Options,
) => BetterSqlite3Database

type DriverStatement = {
  all: (...params: readonly unknown[]) => unknown[]
  get: (...params: readonly unknown[]) => unknown
  iterate: (...params: readonly unknown[]) => Iterable<unknown>
  run: (...params: readonly unknown[]) => unknown
}

function createBetterSqlite3Handle(db: BetterSqlite3Database): SqliteDatabase {
  return {
    prepare: (sql) => {
      const stmt = db.prepare(sql)

      return createStatement(stmt as unknown as DriverStatement)
    },
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

function toBetterSqlite3Options(options?: DatabaseOpenOptions): BetterSqlite3Options | undefined {
  if (!options) {
    return undefined
  }

  return {
    readonly: options.readonly,
    fileMustExist: options.fileMustExist,
  }
}

export function resolveSqliteDriver(options?: CreateAppDatabaseOptions): SqliteDriverName {
  return resolveSqliteDriverFromSources({
    driver: options?.driver,
    envDriver: process.env.SQLITE_DRIVER,
    buildTimeDriver: getBuildTimeSqliteDriver(),
  })
}

export function resolveSqliteDriverFromSources(sources: SqliteDriverSources): SqliteDriverName {
  return (
    sources.driver ??
    parseSqliteDriverName(sources.envDriver) ??
    parseSqliteDriverName(sources.buildTimeDriver) ??
    'better-sqlite3'
  )
}

/**
 * 共通で扱う open option だけを受け取り、driver 非依存の `Database` を返します。
 * `filePath` の解決は呼び出し側の責務です。
 */
export function createAppDatabase(filePath: string, options?: CreateAppDatabaseOptions): Database {
  const driver = resolveSqliteDriver(options)

  if (driver === 'node:sqlite') {
    return openNodeSqliteDatabase(filePath, options)
  }

  return createBetterSqlite3Database(filePath, options)
}

function createBetterSqlite3Database(filePath: string, options?: DatabaseOpenOptions): Database {
  const BetterSqlite3 = loadBetterSqlite3()
  return createDatabase(
    createBetterSqlite3Handle(new BetterSqlite3(filePath, toBetterSqlite3Options(options))),
  )
}

function loadBetterSqlite3(): BetterSqlite3Constructor {
  try {
    return require('better-sqlite3') as BetterSqlite3Constructor
  } catch (error) {
    throw new Error(
      'better-sqlite3 is not installed or could not be loaded. Use SQLITE_DRIVER=node:sqlite or install and rebuild better-sqlite3.',
      { cause: error },
    )
  }
}

function getBuildTimeSqliteDriver(): string | undefined {
  if (typeof __SQLITE_DRIVER__ === 'undefined') {
    return undefined
  }

  return __SQLITE_DRIVER__
}
