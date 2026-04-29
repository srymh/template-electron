/**
 * better-sqlite3 を @repo/sqlite の `DataBase` に接続する desktop app 側の adapter。
 *
 * このファイルの責務:
 * - better-sqlite3 の生成を app 側に閉じ込める
 * - better-sqlite3 と `@repo/sqlite` の型差を吸収する
 * - 呼び出し側へ driver 非依存の `DataBase` を返す
 *
 * このファイルが決めないこと:
 * - DB ファイルの場所や名前
 * - テーブル定義やマイグレーション
 * - 認証や家計簿など feature 固有の初期化
 *
 * 注意:
 * - better-sqlite3 の native rebuild と配布設定は apps/desktop 側で維持します。
 * - better-sqlite3 は同期 I/O のため、レンダラープロセスから直接呼び出しません。
 */
import BetterSqlite3 from 'better-sqlite3'
import type {
  Database as BetterSqlite3Database,
  Options as BetterSqlite3Options,
} from 'better-sqlite3'

import { createDataBase } from '@repo/sqlite'
import type { DataBase, SqliteDatabaseHandle } from '@repo/sqlite'

export type DataBaseOpenOptions = {
  readonly?: boolean
  fileMustExist?: boolean
}

function createBetterSqlite3Handle(db: BetterSqlite3Database): SqliteDatabaseHandle {
  return {
    prepare: (sql) => {
      const stmt = db.prepare(sql)

      // better-sqlite3 の Statement 型を共通抽象に合わせて包む。
      return {
        all: (...params) => stmt.all(...(params as any[])),
        get: (...params) => stmt.get(...(params as any[])),
        run: (...params) => stmt.run(...(params as any[])),
      }
    },
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  }
}

function toBetterSqlite3Options(options?: DataBaseOpenOptions): BetterSqlite3Options | undefined {
  if (!options) {
    return undefined
  }

  return {
    readonly: options.readonly,
    fileMustExist: options.fileMustExist,
  }
}

/**
 * 共通で扱う open option だけを受け取り、driver 非依存の `DataBase` を返します。
 * `filePath` の解決は呼び出し側の責務です。
 */
export function createAppDataBase(filePath: string, options?: DataBaseOpenOptions): DataBase {
  return createDataBase(
    createBetterSqlite3Handle(new BetterSqlite3(filePath, toBetterSqlite3Options(options))),
  )
}
