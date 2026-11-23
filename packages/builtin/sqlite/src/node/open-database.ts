import { DatabaseSync } from 'node:sqlite'
import type { SQLInputValue } from 'node:sqlite'

import type { ConnectionOptions } from '../connection-options'
import { createDatabase } from '../database'
import type { Database } from '../database'

export type NodeDatabaseOptions = {
  readOnly?: boolean
  connection?: ConnectionOptions
}

/** 共通境界のunknownをNode driverが受け付けるSQLite値へ検証して変換する。 */
function toInputValue(value: unknown): SQLInputValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  )
    return value
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  throw new TypeError('Unsupported SQLite parameter')
}

/** node:sqliteで接続を開く。設定失敗時は生成した接続を解放し、成功後の所有権を返す。 */
export function openNodeDatabase(filePath: string, options: NodeDatabaseOptions = {}): Database {
  const handle = new DatabaseSync(filePath, { readOnly: options.readOnly })
  try {
    return createDatabase(
      {
        prepare: (sql) => {
          const statement = handle.prepare(sql)
          return {
            all: (...params) => statement.all(...params.map(toInputValue)),
            get: (...params) => statement.get(...params.map(toInputValue)),
            run: (...params) => statement.run(...params.map(toInputValue)),
          }
        },
        exec: (sql) => handle.exec(sql),
        close: () => handle.close(),
      },
      options.connection,
    )
  } catch (error) {
    try {
      handle.close()
    } catch {
      /* 接続設定時の例外を維持する。 */
    }
    throw error
  }
}
