import { runInSavepoint } from '@repo/sqlite'
import type { Database, SynchronousOperation } from '@repo/sqlite'

import { matchesIndexRecord } from '../index-record'
import type {
  CreateOrMatchResult,
  ObjectIndex,
  ObjectIndexRecord,
  RenameObjectIndexResult,
} from '../index-store'
import {
  normalizeMetadata,
  validateIndexInput,
  validateIndexRecord,
  validateKey,
  validateListRange,
  validateRevision,
} from '../validation'

const columns = `key, lower(hex(sha256)) AS sha256, byte_size AS "byteSize", metadata_json AS "metadataJson", CAST(revision AS TEXT) AS revision`

/**
 * 接続の所有権を受け取らず、専用indexのschemaを作成・検証する。
 * キーの順序（BINARY照合）をUTF-8のバイト列の順にするため、UTF-8以外のDBは新規・既存とも拒否する。
 * DBの変換や作り直しは行わない。
 */
function initialize(database: Database): void {
  const encoding = database.get<{ encoding: string }>('PRAGMA encoding')?.encoding
  if (encoding !== 'UTF-8')
    throw new Error(
      `object store indexにはUTF-8のSQLite DBを使用してください: ${encoding ?? '不明'}`,
    )
  const table = database.get(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'object_store_schema'`,
  )
  if (table) {
    const version = database.get<{ version: number }>(
      'SELECT version FROM object_store_schema WHERE singleton_id = 1',
    )?.version
    if (version !== 1) throw new Error(`未対応のobject store schemaです: ${version ?? '不明'}`)
    return
  }
  if (
    database.get(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'object_store_entry'`)
  )
    throw new Error('version管理のないobject store indexは使用できません。')
  // 呼び出し側のtransaction内でも利用できるよう、schema作成をsavepointでまとめる。
  runInSavepoint(database, () => {
    database.exec(`
      CREATE TABLE object_store_schema (
        singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
        version INTEGER NOT NULL CHECK (version > 0)
      ) STRICT;
      INSERT INTO object_store_schema VALUES (1, 1);
      CREATE TABLE object_store_entry (
        key TEXT PRIMARY KEY CHECK (length(key) > 0),
        sha256 BLOB NOT NULL CHECK (typeof(sha256) = 'blob' AND length(sha256) = 32),
        byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
        metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json)),
        revision INTEGER NOT NULL CHECK (revision > 0)
      ) STRICT, WITHOUT ROWID;
      CREATE INDEX object_store_entry_sha256_idx ON object_store_entry (sha256);
      CREATE TABLE object_store_revision (
        singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
        value INTEGER NOT NULL CHECK (value >= 0)
      ) STRICT;
      INSERT INTO object_store_revision VALUES (1, 0);
    `)
  })
}

/** CASへの参照とキー単位のmetadataを、SQLiteへ原子的に保存する。 */
export function createSqliteObjectIndex(database: Database): ObjectIndex {
  initialize(database)
  return {
    createOrMatch: async (input) => {
      const record = validateIndexInput(input)
      return write(database, (): CreateOrMatchResult => {
        // writeが取得した書き込みlockの内側で、現在状態を読み取り照合する。
        const existing = database.get(`SELECT ${columns} FROM object_store_entry WHERE key = ?`, [
          record.key,
        ])
        if (existing !== undefined) {
          const current = parseRow(existing)
          return matchesIndexRecord(current, record)
            ? { status: 'matched', record: current }
            : { status: 'conflict' }
        }
        const revision = nextRevision(database)
        const row = database.get(
          `INSERT INTO object_store_entry (key, sha256, byte_size, metadata_json, revision)
           VALUES (?, unhex(?), ?, ?, CAST(? AS INTEGER))
           RETURNING ${columns}`,
          [record.key, record.sha256, record.byteSize, JSON.stringify(record.metadata), revision],
        )
        return { status: 'created', record: parseRow(row) }
      })
    },
    find: async (key) => {
      const row = database.get(`SELECT ${columns} FROM object_store_entry WHERE key = ?`, [
        validateKey(key),
      ])
      return row === undefined ? null : parseRow(row)
    },
    list: async function* () {
      // 有限のpageを順に読む。列挙全体のsnapshotや並行変更の完全な捕捉は保証しない。
      let after: string | null = null
      while (true) {
        const rows: unknown[] =
          after === null
            ? database.query(`SELECT ${columns} FROM object_store_entry ORDER BY key LIMIT 100`)
            : database.query(
                `SELECT ${columns} FROM object_store_entry WHERE key > ? ORDER BY key LIMIT 100`,
                [after],
              )
        if (rows.length === 0) return
        for (const row of rows) {
          const record = parseRow(row)
          after = record.key
          yield record
        }
      }
    },
    listRange: async (range) => {
      // 範囲より前の行はSQLiteが読み飛ばし、JavaScriptへは範囲内の行だけを渡す。
      const { offset, limit } = validateListRange(range)
      return database
        .query(`SELECT ${columns} FROM object_store_entry ORDER BY key LIMIT ? OFFSET ?`, [
          limit,
          offset,
        ])
        .map(parseRow)
    },
    updateMetadata: async (key, expectedRevision, metadata) => {
      validateKey(key)
      validateRevision(expectedRevision)
      const normalized = normalizeMetadata(metadata)
      if (
        !database.get(
          'SELECT 1 FROM object_store_entry WHERE key = ? AND CAST(revision AS TEXT) = ?',
          [key, expectedRevision],
        )
      )
        return null
      return write(database, () => {
        const revision = nextRevision(database)
        const row = database.get(
          `UPDATE object_store_entry SET metadata_json = ?, revision = CAST(? AS INTEGER)
           WHERE key = ? AND CAST(revision AS TEXT) = ? RETURNING ${columns}`,
          [JSON.stringify(normalized), revision, key, expectedRevision],
        )
        return row === undefined ? null : parseRow(row)
      })
    },
    rename: async (key, newKey, expectedRevision) => {
      validateKey(key)
      validateKey(newKey)
      validateRevision(expectedRevision)
      return write(database, (): RenameObjectIndexResult => {
        const row = database.get(`SELECT ${columns} FROM object_store_entry WHERE key = ?`, [key])
        if (row === undefined) return { status: 'missing-key' }
        const current = parseRow(row)
        if (current.revision !== expectedRevision) return { status: 'revision-conflict' }
        if (key === newKey) return { status: 'unchanged', record: current }
        if (database.get('SELECT 1 FROM object_store_entry WHERE key = ?', [newKey]))
          return { status: 'key-conflict' }
        // writer lockの内側で参照だけを変更し、採番も同じsavepointへ含める。
        const updated = database.get(
          `UPDATE object_store_entry SET key = ?, revision = CAST(? AS INTEGER)
           WHERE key = ? RETURNING ${columns}`,
          [newKey, nextRevision(database), key],
        )
        return { status: 'renamed', record: parseRow(updated) }
      })
    },
    remove: async (key) =>
      database.get('DELETE FROM object_store_entry WHERE key = ? RETURNING key', [
        validateKey(key),
      ]) !== undefined,
  }
}

/** 読み取り判定前に書き込みlockを取得し、判定・採番・更新を同じsavepointで行う。 */
function write<T>(database: Database, operation: SynchronousOperation<T>): T {
  return runInSavepoint(
    database,
    () => {
      // 採番せずにwriterを予約する。一致・競合の判定ではカウンターを進めない。
      database.run('UPDATE object_store_revision SET value = value WHERE singleton_id = 1')
      return operation()
    },
    {
      // 競合した操作にはrevisionを消費させない。例外時も採番と行更新をまとめて戻す。
      rollbackWhen: (result) => result === null,
    },
  )
}

/** SQLite内で64bit整数を加算し、JSのnumberを経由せず文字列で受け取る。 */
function nextRevision(database: Database): string {
  const row = database.get<{ revision: string }>(
    `UPDATE object_store_revision SET value = value + 1
     WHERE singleton_id = 1 AND value < 9223372036854775807
     RETURNING CAST(value AS TEXT) AS revision`,
  )
  if (!row) throw new RangeError('Object indexのrevisionを使い切ったか、採番状態が欠落しています。')
  return row.revision
}

function parseRow(value: unknown): ObjectIndexRecord {
  if (value === null || typeof value !== 'object')
    throw new TypeError('Object indexの行が不正です。')
  const row = value as Record<string, unknown>
  if (
    typeof row.key !== 'string' ||
    typeof row.sha256 !== 'string' ||
    typeof row.byteSize !== 'number' ||
    typeof row.metadataJson !== 'string' ||
    typeof row.revision !== 'string'
  )
    throw new TypeError('Object indexの列が不正です。')
  const metadata: unknown = JSON.parse(row.metadataJson)
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata))
    throw new TypeError('Object metadataが不正です。')
  // JSONから読んだ値のcastはこの境界に限定し、直後に各フィールドを検証する。
  return validateIndexRecord({
    key: row.key,
    sha256: row.sha256,
    byteSize: row.byteSize,
    revision: row.revision,
    metadata: normalizeMetadata(metadata),
  })
}
