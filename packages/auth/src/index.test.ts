import { DatabaseSync } from 'node:sqlite'

import { describe, expect, it, vi } from 'vitest'

import { createDataBase } from '@repo/sqlite'
import type { SqliteDatabaseHandle } from '@repo/sqlite'

import { createAuthRuntime } from './index'

describe('createAuthRuntime', () => {
  it('creates a user session on first login and returns the current auth status', () => {
    const createInMemoryDb = () =>
      createDataBase(new DatabaseSync(':memory:') as unknown as SqliteDatabaseHandle)

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
    const handle = new DatabaseSync(':memory:')
    const closeSpy = vi.spyOn(handle, 'close')

    const runtime = createAuthRuntime({
      db: createDataBase(handle as unknown as SqliteDatabaseHandle),
      closeDbOnDispose: true,
    })

    runtime.dispose()

    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(() => runtime.getStatus()).toThrow('AuthRuntime is disposed')
  })
})
