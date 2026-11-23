import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { afterEach, expect, it, vi } from 'vitest'

import { createDatabase } from '../index'
import type { ConnectionOptions, Database, SqliteDatabaseHandle } from '../index'
import { openTestDatabase } from '../testing'
import { openNodeDatabase } from './index'

const databases: Database[] = []
const roots: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const database of databases.splice(0)) database.close()
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

function temporaryFile() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-sqlite-'))
  roots.push(root)
  return path.join(root, 'test.db')
}

it('型付き設定を反映し、ファイルを再接続して永続データを読める', () => {
  const file = temporaryFile()
  const database = openNodeDatabase(file, {
    connection: {
      foreignKeys: true,
      journalMode: 'wal',
      synchronous: 'normal',
      busyTimeoutMs: 120,
    },
  })
  try {
    expect(database.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 })
    expect(database.get('PRAGMA journal_mode')).toEqual({ journal_mode: 'wal' })
    expect(database.get('PRAGMA synchronous')).toEqual({ synchronous: 1 })
    expect(database.get('PRAGMA busy_timeout')).toEqual({ timeout: 120 })
    database.exec('CREATE TABLE entry (id INTEGER PRIMARY KEY, data BLOB, label TEXT)')
    database.run('INSERT INTO entry VALUES (?, ?, ?)', [1, new Uint8Array([1, 2]), 'test'])
  } finally {
    database.close()
  }
  const reopened = openNodeDatabase(file, { readOnly: true })
  databases.push(reopened)
  expect(reopened.query('SELECT id, label, hex(data) AS data FROM entry')).toEqual([
    { id: 1, label: 'test', data: '0102' },
  ])
  expect(() => reopened.run('DELETE FROM entry')).toThrow(/readonly/)
})

it('未指定項目を変更せず、明示したfalseも適用する', () => {
  const database = openTestDatabase(':memory:', { foreignKeys: false })
  databases.push(database)
  expect(database.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 0 })
  expect(database.get('PRAGMA journal_mode')).toEqual({ journal_mode: 'memory' })
})

it('memory DBのWAL指定を黙って無視しない', () => {
  expect(() => openNodeDatabase(':memory:', { connection: { journalMode: 'wal' } })).toThrow(
    'journal_mode',
  )
})

it('既存handleの設定失敗では所有者の接続を閉じない', () => {
  const database = openTestDatabase()
  databases.push(database)
  const close = vi.spyOn(database, 'close')
  const handle: SqliteDatabaseHandle = {
    prepare: (sql) => ({
      all: () => database.query(sql),
      get: () => database.get(sql),
      run: () => database.run(sql),
    }),
    exec: (sql) => database.exec(sql),
    close,
  }
  expect(() => createDatabase(handle, { journalMode: 'wal' })).toThrow('journal_mode')
  expect(close).not.toHaveBeenCalled()
  expect(database.get('SELECT 1 AS value')).toEqual({ value: 1 })
})

it('transaction中に無視された外部キー変更を検出する', () => {
  const database = openTestDatabase(':memory:', { foreignKeys: false })
  databases.push(database)
  database.exec('BEGIN')
  try {
    expect(() =>
      createDatabase(
        {
          prepare: (sql) => ({
            all: () => database.query(sql),
            get: () => database.get(sql),
            run: () => database.run(sql),
          }),
          exec: (sql) => database.exec(sql),
          close: () => {},
        },
        { foreignKeys: true },
      ),
    ).toThrow('foreign_keys')
  } finally {
    database.exec('ROLLBACK')
  }
})

it.each([
  { foreignKeys: 'ON' },
  { journalMode: 'wal; DROP TABLE entry' },
  { synchronous: 'invalid' },
  { busyTimeoutMs: -1 },
  { busyTimeoutMs: 1.5 },
  { busyTimeoutMs: Infinity },
  { busyTimeoutMs: 2_147_483_648 },
])('不正な設定をSQL実行前に拒否する: %j', (connection) => {
  const exec = vi.fn()
  expect(() =>
    createDatabase({ prepare: vi.fn(), exec, close: vi.fn() }, connection as ConnectionOptions),
  ).toThrow()
  expect(exec).not.toHaveBeenCalled()
})

it('SQLパラメータを検証し、未取得行はundefinedを返す', () => {
  const database = openNodeDatabase(':memory:')
  databases.push(database)
  expect(database.get('SELECT 1 WHERE 0')).toBeUndefined()
  expect(database.get('SELECT ? AS value', [null])).toEqual({ value: null })
  expect(() => database.get('SELECT ?', [{}])).toThrow('Unsupported SQLite parameter')
})

it('テスト用接続はschemaを作成せず二重closeできる', () => {
  const database = openTestDatabase()
  expect(database.query("SELECT name FROM sqlite_master WHERE type = 'table'")).toEqual([])
  database.close()
  database.close()
})

it('Node factoryは設定失敗時に生成済み接続を解放する', () => {
  const close = vi.spyOn(DatabaseSync.prototype, 'close')
  expect(() => openNodeDatabase(':memory:', { connection: { journalMode: 'wal' } })).toThrow(
    'journal_mode',
  )
  expect(close).toHaveBeenCalledOnce()
})
