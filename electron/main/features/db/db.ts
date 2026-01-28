/**
 * better-sqlite3 を用いた同期アクセスの薄いラッパー。
 *
 * 想定ユースケース:
 * - Electron メインプロセスでの DB 参照/更新
 * - 読み取り専用の同梱 DB を開いて簡易クエリ
 *
 * 注意:
 * - better-sqlite3 は同期 I/O のため、レンダラープロセスから直接呼び出さないでください。
 *   別スレッド/メインプロセス経由（IPC）で実行することを推奨します。
 * - アプリに DB ファイルを同梱する場合は、electron-builder の files 設定に含め、実行時は解決済みの
 *   実パス（app.getAppPath() または process.resourcesPath など）を渡してください。
 * - 本ファイルでは DB の「ファイル名」をハードコードしません。"data" フォルダ直下に配置するという
 *   制約のもと、利用側からファイル名を受け取って解決します。
 */
import BetterSqlite3 from 'better-sqlite3'

import type { Database as BetterSqlite3Database, Options } from 'better-sqlite3'

/**
 * DataBase
 *
 * コンストラクタに DB ファイルパスを渡すだけで準備完了です。
 *
 * 例: （Electron メインプロセス）
 * @example
 *   import { app } from 'electron'
 *   import { DataBase } from './db'
 *
 *   const dbPath = path.join(process.resourcesPath, 'data', 'your.db')
 *   const db = new DataBase(dbPath, { readonly: true })
 *   const rows = db.query('SELECT * FROM some_table WHERE id = ?', [1])
 *
 * options の主な項目:
 * - readonly: boolean … 読み取り専用で開く
 * - fileMustExist: boolean … ファイルが存在しない場合に例外
 */
export class DataBase {
  private db: BetterSqlite3Database

  constructor(dbPath: string, options?: Options) {
    this.db = new BetterSqlite3(dbPath, options)
  }

  /**
   * 複数行を取得するクエリ実行（SELECT 想定）。
   * @param sql 実行する SQL（? プレースホルダ対応）
   * @param params プレースホルダに対応する値配列
   * @returns 取得した行配列。型パラメータ T で行の型を指定可能。
   */
  query<T = any>(sql: string, params?: any[]): T[] {
    const stmt = this.db.prepare(sql)
    return (params ? stmt.all(...params) : stmt.all()) as T[]
  }

  /**
   * 単一行を取得するクエリ実行（SELECT 想定）。
   * @param sql 実行する SQL（? プレースホルダ対応）
   * @param params プレースホルダに対応する値配列
   * @returns 取得した1行。見つからない場合は undefined。
   */
  get<T = any>(sql: string, params?: any[]): T | undefined {
    const stmt = this.db.prepare(sql)
    return (params ? stmt.get(...params) : stmt.get()) as T | undefined
  }

  /**
   * 書き込み系（INSERT/UPDATE/DELETE 等）を実行。
   * @param sql 実行する SQL（? プレースホルダ対応）
   * @param params プレースホルダに対応する値配列
   */
  run(sql: string, params?: any[]): void {
    const stmt = this.db.prepare(sql)
    if (params) {
      stmt.run(...params)
    } else {
      stmt.run()
    }
  }

  /**
   * 1 つ以上の SQL をまとめて実行（DDL 等で使用）。
   * セミコロン区切りで複数ステートメントを実行可能。
   * @param sql 実行する SQL テキスト
   */
  exec(sql: string): void {
    this.db.exec(sql)
  }

  /**
   * DB をクローズします。不要になったら早めに呼び出してください。
   */
  close(): void {
    this.db.close()
  }
}

/**
 * 既定の場所から DB を開くファクトリ。
 * @param options better-sqlite3 のオプション（readonly 推奨）
 */
export function createAppDataBase(
  filePath: string,
  options?: Options,
): DataBase {
  return new DataBase(filePath, options)
}
