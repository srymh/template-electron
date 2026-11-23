import type { Database } from './database'
import { assertSynchronousResult } from './synchronous-operation'
import type { SynchronousOperation } from './synchronous-operation'

export type TransactionOptions = {
  mode?: 'deferred' | 'immediate' | 'exclusive'
}

/**
 * 同期処理をtransactionで実行し、成功時にcommitする。既定はIMMEDIATE、ネストは未対応。
 * 処理・commitの失敗時はrollbackを試み、後始末の失敗で元の例外を上書きしない。
 * callbackは非同期処理を開始してはならない。返されたthenableはcommitせず拒否する。
 */
export function runInTransaction<T>(
  database: Database,
  operation: SynchronousOperation<T>,
  options: TransactionOptions = {},
): T {
  const mode = options.mode ?? 'immediate'
  if (!['deferred', 'immediate', 'exclusive'].includes(mode))
    throw new TypeError('Invalid transaction mode')
  // BEGINの失敗は既存transactionを所有していないためrollbackしない。
  database.exec(`BEGIN ${mode.toUpperCase()}`)
  try {
    const result = operation()
    assertSynchronousResult(result)
    database.exec('COMMIT')
    return result
  } catch (error) {
    try {
      database.exec('ROLLBACK')
    } catch {
      // SQLiteの自動rollbackなどによる二次エラーより、発端の例外を優先する。
    }
    throw error
  }
}
