import type { ConnectionOptions } from '../connection-options'
import type { Database } from '../database'
import { openNodeDatabase } from '../node'

/** 実SQLiteの空DBを開く。外部キーを既定で有効にし、schemaは作成せず、closeは複数回呼べる。ファイル指定で永続化も検証できる。 */
export function openTestDatabase(filePath = ':memory:', connection?: ConnectionOptions): Database {
  const database = openNodeDatabase(filePath, { connection: { foreignKeys: true, ...connection } })
  const close = database.close.bind(database)
  let closed = false
  database.close = () => {
    if (closed) return
    close()
    closed = true
  }
  return database
}
