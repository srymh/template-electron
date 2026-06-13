/**
 * SQLite ドライバー名のリスト
 */
export const SQLITE_DRIVER_NAMES = ['better-sqlite3', 'node:sqlite'] as const

/**
 * SQLite ドライバー名の型
 */
export type SqliteDriverName = (typeof SQLITE_DRIVER_NAMES)[number]

/**
 * SQLite データベースを開く際のオプション
 */
export type DatabaseOpenOptions = {
  /**
   * データベースを読み取り専用で開くかどうか
   */
  readonly?: boolean
  /**
   * データベースファイルが存在しない場合にエラーをスローするかどうか
   */
  fileMustExist?: boolean
}

/**
 * SQLite のクエリ実行結果
 */
export type SqliteRunResult = {
  /**
   * クエリによって変更された行数
   */
  changes: number
  /**
   * 最後に挿入された行の ID (存在する場合)
   */
  lastInsertRowid?: number | bigint
}

/**
 * SQLite ステートメントのインターフェース
 */
export type SqliteStatement = {
  /**
   * クエリを実行してすべての結果を配列で返す
   * @param params クエリのパラメータ
   * @returns クエリの結果の配列
   */
  all: <T = unknown>(...params: readonly unknown[]) => T[]
  /**
   * クエリを実行して最初の結果を返す
   * @param params クエリのパラメータ
   * @returns クエリの最初の結果
   */
  get: <T = unknown>(...params: readonly unknown[]) => T | undefined
  /**
   * クエリを実行して結果を反復可能なオブジェクトとして返す
   * @param params クエリのパラメータ
   * @returns クエリの結果の反復可能なオブジェクト
   */
  iterate: <T = unknown>(...params: readonly unknown[]) => Iterable<T>
  /**
   * クエリを実行して結果を返す
   * @param params クエリのパラメータ
   * @returns クエリの実行結果
   */
  run: (...params: readonly unknown[]) => SqliteRunResult
}

/**
 * SQLite データベースのインターフェース
 */
export type SqliteDatabase = {
  /**
   * SQL クエリを準備してステートメントオブジェクトを返す
   * @param sql SQL クエリ文字列
   * @returns ステートメントオブジェクト
   */
  prepare: (sql: string) => SqliteStatement
  /**
   * SQL クエリを実行する
   * @param sql SQL クエリ文字列
   */
  exec: (sql: string) => void
  /**
   * データベースを閉じる
   */
  close: () => void
}

/**
 * SQLite データベースのハンドルの型エイリアス
 */
export type SqliteDatabaseHandle = SqliteDatabase

/**
 * SQLite データベースクラス
 */
export class Database {
  /**
   * データベースクラスのコンストラクタ
   * @param db SQLite データベースオブジェクト
   */
  constructor(private readonly db: SqliteDatabase) {}

  /**
   * SQL クエリを実行してすべての結果を配列で返す
   * @param sql SQL クエリ文字列
   * @param params クエリのパラメータ
   * @returns クエリの結果の配列
   */
  query<T = unknown>(sql: string, params?: readonly unknown[]): T[] {
    const stmt = this.db.prepare(sql)
    return params ? stmt.all<T>(...params) : stmt.all<T>()
  }

  /**
   * SQL クエリを実行して最初の結果を返す
   * @param sql SQL クエリ文字列
   * @param params クエリのパラメータ
   * @returns クエリの最初の結果
   */
  get<T = unknown>(sql: string, params?: readonly unknown[]): T | undefined {
    const stmt = this.db.prepare(sql)
    return params ? stmt.get<T>(...params) : stmt.get<T>()
  }

  /**
   * SQL クエリを実行して結果を反復可能なオブジェクトとして返す
   * @param sql SQL クエリ文字列
   * @param params クエリのパラメータ
   * @returns クエリの結果の反復可能なオブジェクト
   */
  iterate<T = unknown>(sql: string, params?: readonly unknown[]): Iterable<T> {
    const stmt = this.db.prepare(sql)
    return params ? stmt.iterate<T>(...params) : stmt.iterate<T>()
  }

  /**
   * SQL クエリを実行して結果を返す
   * @param sql SQL クエリ文字列
   * @param params クエリのパラメータ
   * @returns クエリの実行結果
   */
  run(sql: string, params?: readonly unknown[]): SqliteRunResult {
    const stmt = this.db.prepare(sql)
    return params ? stmt.run(...params) : stmt.run()
  }

  /**
   * SQL クエリを実行する
   * @param sql SQL クエリ文字列
   */
  exec(sql: string): void {
    this.db.exec(sql)
  }

  /**
   * データベースを閉じる
   */
  close(): void {
    this.db.close()
  }
}

/**
 * SQLite データベースオブジェクトから Database クラスのインスタンスを作成する
 * @param db SQLite データベースオブジェクト
 * @returns Database クラスのインスタンス
 */
export function createDatabase(db: SqliteDatabase): Database {
  return new Database(db)
}

/**
 * 環境変数から SQLite ドライバー名を解析する
 * @param value 環境変数の値
 * @returns SQLite ドライバー名または undefined
 * @throws ドライバー名が無効な場合にエラーをスロー
 */
export function parseSqliteDriverName(value: string | undefined): SqliteDriverName | undefined {
  if (!value) {
    return undefined
  }

  if (isSqliteDriverName(value)) {
    return value
  }

  throw new Error('SQLITE_DRIVER must be "better-sqlite3" or "node:sqlite"')
}

/**
 * 文字列が有効な SQLite ドライバー名かどうかを判定する
 * @param value 判定する文字列
 * @returns value が有効な SQLite ドライバー名である場合は true、そうでない場合は false
 */
export function isSqliteDriverName(value: string): value is SqliteDriverName {
  return SQLITE_DRIVER_NAMES.some((driverName) => driverName === value)
}

/**
 * SQLite の実行結果を正規化する
 *
 * SQLite ドライバーによっては、クエリの実行結果がオブジェクトでない場合や、changes プロパティが存在しない場合があります。
 * この関数は、実行結果を一貫した形式に正規化します。
 *
 * @example
 * // node:sqlite の実行結果を正規化する例
 * const result = db.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
 * const normalizedResult = normalizeSqliteRunResult(result)
 * console.log(normalizedResult) // { changes: 1, lastInsertRowid: 1 }
 *
 * // better-sqlite3 の実行結果を正規化する例
 * const result = db.prepare('UPDATE users SET name = ? WHERE id = ?').run('Bob', 1)
 * const normalizedResult = normalizeSqliteRunResult(result)
 * console.log(normalizedResult) // { changes: 1 }
 *
 * @param result SQLite の実行結果
 * @returns 正規化された実行結果
 */
export function normalizeSqliteRunResult(result: unknown): SqliteRunResult {
  if (!isObjectRecord(result)) {
    return { changes: 0 }
  }

  const changes = typeof result.changes === 'number' ? result.changes : 0
  const lastInsertRowid = result.lastInsertRowid

  if (typeof lastInsertRowid === 'number' || typeof lastInsertRowid === 'bigint') {
    return { changes, lastInsertRowid }
  }

  return { changes }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
