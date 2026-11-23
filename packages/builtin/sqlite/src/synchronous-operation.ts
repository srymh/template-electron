/** SQLiteの同期実行境界へ渡す処理。Promiseを返すcallbackを型付き利用で拒否する。 */
export type SynchronousOperation<T> = () => T & (T extends PromiseLike<unknown> ? never : unknown)

/** 型境界を通らない利用でもthenableを確定前に拒否する。開始済みの非同期処理は取り消せない。 */
export function assertSynchronousResult(result: unknown): void {
  if (
    result !== null &&
    (typeof result === 'object' || typeof result === 'function') &&
    'then' in result &&
    typeof result.then === 'function'
  )
    throw new TypeError('SQLite callback must be synchronous')
}
