import type { Database } from './database'
import { assertSynchronousResult } from './synchronous-operation'
import type { SynchronousOperation } from './synchronous-operation'

export type SavepointOptions<T> = {
  /** 成功した処理の結果から変更を破棄するか選ぶ。判定は同期で行い、戻り値は維持する。 */
  rollbackWhen?: (result: T) => boolean
}

// ネストした呼び出しが互いのsavepointを解放しないよう、内部名を毎回生成する。
let nextSavepointId = 0n

/**
 * 同期処理をsavepointで実行する。成功時に解放し、失敗時は変更を戻して元の例外を再送出する。
 * 外側transactionがあれば確定せず、なければ解放時にcommitする。非同期callbackは拒否する。
 * rollbackWhenがtrueなら成功時も変更を破棄する。業務上の破棄条件は呼び出し側が決める。
 */
export function runInSavepoint<T>(
  database: Database,
  operation: SynchronousOperation<T>,
  options: SavepointOptions<T> = {},
): T {
  const name = `_repo_sqlite_savepoint_${nextSavepointId++}`
  // 開始に失敗した場合は、所有していない外側の境界を後始末しない。
  database.exec(`SAVEPOINT ${name}`)
  try {
    const result = operation()
    assertSynchronousResult(result)
    const shouldRollback = options.rollbackWhen ? options.rollbackWhen(result) : false
    if (typeof shouldRollback !== 'boolean') throw new TypeError('rollbackWhen must return boolean')
    if (shouldRollback) database.exec(`ROLLBACK TO ${name}`)
    database.exec(`RELEASE ${name}`)
    return result
  } catch (error) {
    try {
      database.exec(`ROLLBACK TO ${name}`)
      // rollbackに失敗した状態でRELEASEして部分的な更新をcommitしない。
      database.exec(`RELEASE ${name}`)
    } catch {
      // SQLiteの自動rollback等による二次エラーより、発端の例外を優先する。
    }
    throw error
  }
}

/** 同期処理の結果を返し、成功時もsavepoint内の変更を必ず破棄する。外側の変更は保持する。 */
export function runWithRollback<T>(database: Database, operation: SynchronousOperation<T>): T {
  return runInSavepoint(database, operation, { rollbackWhen: () => true })
}
