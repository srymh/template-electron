import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppDatabase, resolveSqliteDriverFromSources } from './db'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveSqliteDriverFromSources', () => {
  it('uses better-sqlite3 by default', () => {
    expect(resolveSqliteDriverFromSources({})).toBe('better-sqlite3')
  })

  it('prefers an explicit option over environment drivers', () => {
    expect(
      resolveSqliteDriverFromSources({
        driver: 'better-sqlite3',
        envDriver: 'node:sqlite',
        buildTimeDriver: 'node:sqlite',
      }),
    ).toBe('better-sqlite3')
  })

  it('prefers runtime environment over build-time environment', () => {
    expect(
      resolveSqliteDriverFromSources({
        envDriver: 'node:sqlite',
        buildTimeDriver: 'better-sqlite3',
      }),
    ).toBe('node:sqlite')
  })

  it('uses build-time environment when runtime environment is absent', () => {
    expect(resolveSqliteDriverFromSources({ buildTimeDriver: 'node:sqlite' })).toBe('node:sqlite')
  })

  it('rejects unsupported driver names', () => {
    expect(() => resolveSqliteDriverFromSources({ envDriver: 'sqlite3' })).toThrow(
      'SQLITE_DRIVER must be "better-sqlite3" or "node:sqlite"',
    )
  })
})

describe('createAppDatabase', () => {
  it('opens node:sqlite when selected by runtime environment', () => {
    vi.stubEnv('SQLITE_DRIVER', 'node:sqlite')

    const db = createAppDatabase(':memory:')

    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);')
    db.run('INSERT INTO items (name) VALUES (?)', ['coffee'])

    expect(db.get<{ name: string }>('SELECT name FROM items WHERE id = ?', [1])).toEqual({
      name: 'coffee',
    })

    db.close()
  })
})
