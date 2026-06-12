import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { openNodeSqliteDatabase, parseSqliteDriverName } from './index'

const tmpDirs: string[] = []

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sqlite-driver-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('openNodeSqliteDatabase', () => {
  it('runs basic CRUD statements against an in-memory database', () => {
    const db = openNodeSqliteDatabase(':memory:')

    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);')
    const result = db.run('INSERT INTO items (name) VALUES (?)', ['coffee'])

    expect(result.changes).toBe(1)
    expect(result.lastInsertRowid).toBe(1)
    expect(db.get<{ name: string }>('SELECT name FROM items WHERE id = ?', [1])).toEqual({
      name: 'coffee',
    })
    expect(db.query<{ name: string }>('SELECT name FROM items')).toEqual([{ name: 'coffee' }])

    db.close()
  })

  it('iterates rows', () => {
    const db = openNodeSqliteDatabase(':memory:')
    db.exec(
      [
        'CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);',
        "INSERT INTO items (name) VALUES ('coffee'), ('tea');",
      ].join('\n'),
    )

    expect([...db.iterate<{ name: string }>('SELECT name FROM items ORDER BY id')]).toEqual([
      { name: 'coffee' },
      { name: 'tea' },
    ])

    db.close()
  })

  it('rejects a missing file when fileMustExist is enabled', async () => {
    const dir = await createTempDir()
    const dbPath = path.join(dir, 'missing.db')

    expect(() => openNodeSqliteDatabase(dbPath, { fileMustExist: true })).toThrow(
      `SQLite database file does not exist: ${dbPath}`,
    )
  })
})

describe('parseSqliteDriverName', () => {
  it('accepts supported driver names', () => {
    expect(parseSqliteDriverName('better-sqlite3')).toBe('better-sqlite3')
    expect(parseSqliteDriverName('node:sqlite')).toBe('node:sqlite')
    expect(parseSqliteDriverName(undefined)).toBeUndefined()
  })

  it('rejects unsupported driver names', () => {
    expect(() => parseSqliteDriverName('sqlite3')).toThrow(
      'SQLITE_DRIVER must be "better-sqlite3" or "node:sqlite"',
    )
  })
})
