import type { Database } from './database'

/** 接続時に適用するSQLite設定。未指定項目は変更せず、指定値と実効値の不一致は拒否する。 */
export type ConnectionOptions = {
  foreignKeys?: boolean
  journalMode?: 'delete' | 'truncate' | 'persist' | 'memory' | 'wal' | 'off'
  synchronous?: 'off' | 'normal' | 'full' | 'extra'
  busyTimeoutMs?: number
}

/** 設定値を全て検証してから適用する。新規接続のtransaction開始前に使用する。 */
export function configureConnection(database: Database, options: ConnectionOptions): void {
  const settings: Array<{ name: string; value: string | number; expected: string | number }> = []
  if (options.foreignKeys !== undefined) {
    if (typeof options.foreignKeys !== 'boolean') throw new TypeError('foreignKeys must be boolean')
    settings.push({
      name: 'foreign_keys',
      value: Number(options.foreignKeys),
      expected: Number(options.foreignKeys),
    })
  }
  if (options.journalMode !== undefined) {
    if (!['delete', 'truncate', 'persist', 'memory', 'wal', 'off'].includes(options.journalMode))
      throw new TypeError('Invalid journalMode')
    settings.push({
      name: 'journal_mode',
      value: options.journalMode,
      expected: options.journalMode,
    })
  }
  if (options.synchronous !== undefined) {
    const level = ['off', 'normal', 'full', 'extra'].indexOf(options.synchronous)
    if (level < 0) throw new TypeError('Invalid synchronous')
    settings.push({ name: 'synchronous', value: level, expected: level })
  }
  if (options.busyTimeoutMs !== undefined) {
    if (
      !Number.isInteger(options.busyTimeoutMs) ||
      options.busyTimeoutMs < 0 ||
      options.busyTimeoutMs > 2_147_483_647
    )
      throw new RangeError('busyTimeoutMs must be an integer between 0 and 2147483647')
    settings.unshift({
      name: 'busy_timeout',
      value: options.busyTimeoutMs,
      expected: options.busyTimeoutMs,
    })
  }

  // PRAGMAは無視される場合があるため、SQLの成功だけで設定済みとは判断しない。
  for (const { name, value, expected } of settings) {
    database.exec(`PRAGMA ${name} = ${value}`)
    const row = database.get<Record<string, unknown>>(`PRAGMA ${name}`)
    if (!row || Object.values(row)[0] !== expected)
      throw new Error(`SQLite setting ${name} could not be applied (expected ${expected})`)
  }
}
