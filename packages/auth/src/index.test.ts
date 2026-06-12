import { describe, expect, it } from 'vitest'

import { openNodeSqliteDatabase } from '@repo/sqlite'

import { createAuthRuntime } from './index'

describe('createAuthRuntime', () => {
  it('creates a user session on first login and returns the current auth status', () => {
    const createInMemoryDb = () => openNodeSqliteDatabase(':memory:')

    const runtime = createAuthRuntime({
      createDb: createInMemoryDb,
    })

    expect(runtime.getStatus()).toEqual({
      isAuthenticated: false,
      user: null,
    })

    expect(runtime.login(' demo ', 'secret')).toEqual({
      isAuthenticated: true,
      user: { username: 'demo' },
    })

    expect(runtime.getStatus()).toEqual({
      isAuthenticated: true,
      user: { username: 'demo' },
    })

    runtime.dispose()
  })

  it('closes the injected database on dispose when requested and rejects further access', () => {
    const db = openNodeSqliteDatabase(':memory:')

    const runtime = createAuthRuntime({
      db,
      closeDbOnDispose: true,
    })

    runtime.dispose()

    expect(() => db.exec('SELECT 1')).toThrow()
    expect(() => runtime.getStatus()).toThrow('AuthRuntime is disposed')
  })
})
