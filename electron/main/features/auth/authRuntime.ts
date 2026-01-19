import { createAuthDb, ensureAuthDb } from './authDb'
import { getAuthStatus, login, logout } from './authService'

import type { AuthStatus } from './authService'

export type AuthRuntime = {
  getStatus: () => AuthStatus
  login: (username: string, password: string) => AuthStatus
  logout: () => void
  dispose: () => void
}

export function createAuthRuntime(): AuthRuntime {
  const db = createAuthDb()
  ensureAuthDb(db)

  let disposed = false

  const ensureNotDisposed = () => {
    if (disposed) {
      throw new Error('AuthRuntime is disposed')
    }
  }

  return {
    getStatus: () => {
      ensureNotDisposed()
      return getAuthStatus(db)
    },

    login: (username, password) => {
      ensureNotDisposed()
      return login(db, username, password)
    },

    logout: () => {
      ensureNotDisposed()
      return logout(db)
    },

    dispose: () => {
      if (disposed) return
      disposed = true
      db.close()
    },
  }
}
