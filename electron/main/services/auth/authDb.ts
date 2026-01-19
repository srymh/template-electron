import path from 'node:path'
import { app } from 'electron'

import { DataBase } from '../db/db'

function getAuthDbPath() {
  return path.join(app.getPath('userData'), 'auth.db')
}

export function createAuthDb(): DataBase {
  const dbPath = getAuthDbPath()

  console.log(`Auth DB Path: ${dbPath}`)

  return new DataBase(dbPath)
}

export function ensureAuthDb(db: DataBase): void {
  db.exec(
    [
      /**
       * データベース全体の設定
       * - foreign_keys: 外部キー制約を有効化
       * - journal_mode: トランザクションログのモードをWALに設定
       * - synchronous: データベースの同期モードをNORMALに設定
       */
      'PRAGMA foreign_keys = ON;',
      'PRAGMA journal_mode = WAL;',
      'PRAGMA synchronous = NORMAL;',

      /**
       * 認証ユーザーテーブル
       * - id: ユーザーID（主キー、自動増分）
       * - username: ユーザー名（一意制約付き）
       * - password_hash: パスワードのハッシュ値
       * - password_salt: パスワードのソルト値
       * - password_kdf: パスワードのKDFアルゴリズム
       * - password_kdf_params: KDFのパラメータ（JSON形式）
       * - created_at: レコード作成日時
       * - updated_at: レコード更新日時
       * - disabled_at: ユーザー無効化日時（NULL可能）
       *
       * 解説:
       * - password_saltはBLOB型で保存し、バイナリデータとして扱うことでセキュリティを向上させています。
       * - password_kdf_paramsはJSON形式で保存し、将来的なKDFパラメータの拡張に対応できるようにしています。
       * - disabled_atがNULLの場合、ユーザーは有効であり、値が設定されている場合は無効化されたことを示します。
       *
       * 補足事項:
       * - ソルト（salt）とは、パスワードハッシュを生成する際に使用されるランダムなデータであり、同じパスワードでも異なるハッシュ値を生成するために利用されます。
       * - KDF（Key Derivation Function）とは、パスワードから暗号鍵を生成するための関数であり、セキュリティ強化のために使用されます。
       */
      `CREATE TABLE IF NOT EXISTS auth_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt BLOB NOT NULL,
        password_kdf TEXT NOT NULL,
        password_kdf_params TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        disabled_at TEXT
      );`,

      /**
       * 認証セッションテーブル
       * - id: セッションID（主キー、自動増分）
       * - user_id: ユーザーID（外部キー、auth_usersテーブル参照）
       * - is_current: 現在のセッションフラグ（1: 現在のセッション、0: 過去のセッション）
       * - created_at: セッション作成日時
       * - last_used_at: 最終使用日時
       * - expires_at: セッション有効期限日時
       * - revoked_at: セッション無効化日時（NULL可能）
       */
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        is_current INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY(user_id) REFERENCES auth_users(id) ON DELETE CASCADE
      );`,

      /**
       * インデックスの作成
       * - ux_auth_sessions_current: 現在のセッションに対する一意インデックス
       * - ix_auth_sessions_user_id: ユーザーIDに対するインデックス
       */
      'CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_sessions_current ON auth_sessions(is_current) WHERE is_current = 1;',
      'CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_id ON auth_sessions(user_id);',
    ].join('\n'),
  )
}
