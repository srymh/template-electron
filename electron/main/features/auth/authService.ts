import crypto from 'node:crypto'

import type { DataBase } from '../db/db'

export type AuthUser = {
  username: string
}

export type AuthStatus = {
  isAuthenticated: boolean
  user: AuthUser | null
}

type DbAuthUser = {
  id: number
  username: string
  password_hash: string
  password_salt: Buffer
  password_kdf_params: string
  disabled_at: string | null
}

type DbAuthSessionWithUser = {
  username: string
  expires_at: string
}

const DEFAULT_SESSION_YEARS = 10

function nowIso() {
  return new Date().toISOString()
}

function computeExpiresAtIso() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + DEFAULT_SESSION_YEARS)
  return d.toISOString()
}

function createPasswordRecord(password: string) {
  const salt = crypto.randomBytes(16)

  const params = {
    kdf: 'scrypt',
    cost: 16384,
    blockSize: 8,
    parallelization: 1,
    keylen: 64,
  } as const

  const hash = crypto
    .scryptSync(password, salt, params.keylen, {
      cost: params.cost,
      blockSize: params.blockSize,
      parallelization: params.parallelization,
    })
    .toString('hex')

  return {
    passwordHash: hash,
    passwordSalt: salt,
    passwordKdf: params.kdf,
    passwordKdfParams: JSON.stringify(params),
  }
}

function verifyPassword(password: string, user: DbAuthUser) {
  const params = JSON.parse(user.password_kdf_params) as {
    kdf: string
    cost: number
    blockSize: number
    parallelization: number
    keylen: number
  }

  if (params.kdf !== 'scrypt') return false

  const hash = crypto
    .scryptSync(password, user.password_salt, params.keylen, {
      cost: params.cost,
      blockSize: params.blockSize,
      parallelization: params.parallelization,
    })
    .toString('hex')

  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(user.password_hash, 'hex')
  if (a.length !== b.length) return false

  return crypto.timingSafeEqual(a, b)
}

function revokeCurrentSession(db: DataBase, revokedAt: string) {
  db.run(
    'UPDATE auth_sessions SET revoked_at = ?, is_current = 0 WHERE is_current = 1 AND revoked_at IS NULL',
    [revokedAt],
  )
}

function createCurrentSession(db: DataBase, userId: number) {
  const createdAt = nowIso()
  const expiresAt = computeExpiresAtIso()

  db.run(
    'INSERT INTO auth_sessions (user_id, is_current, created_at, last_used_at, expires_at, revoked_at) VALUES (?, 1, ?, ?, ?, NULL)',
    [userId, createdAt, createdAt, expiresAt],
  )
}

function readCurrentSessionUser(
  db: DataBase,
): DbAuthSessionWithUser | undefined {
  return db.get<DbAuthSessionWithUser>(
    [
      'SELECT u.username as username, s.expires_at as expires_at',
      'FROM auth_sessions s',
      'JOIN auth_users u ON u.id = s.user_id',
      'WHERE s.is_current = 1 AND s.revoked_at IS NULL AND u.disabled_at IS NULL',
      'LIMIT 1',
    ].join('\n'),
  )
}

export function getAuthStatus(db: DataBase): AuthStatus {
  const row = readCurrentSessionUser(db)
  if (!row) {
    return { isAuthenticated: false, user: null }
  }

  if (Number.isNaN(Date.parse(row.expires_at))) {
    return { isAuthenticated: false, user: null }
  }

  if (Date.parse(row.expires_at) <= Date.now()) {
    return { isAuthenticated: false, user: null }
  }

  db.run(
    'UPDATE auth_sessions SET last_used_at = ? WHERE is_current = 1 AND revoked_at IS NULL',
    [nowIso()],
  )

  return {
    isAuthenticated: true,
    user: { username: row.username },
  }
}

export function login(
  db: DataBase,
  username: string,
  password: string,
): AuthStatus {
  const normalized = username.trim()
  if (!normalized) {
    throw new Error('username is required')
  }

  db.exec('BEGIN IMMEDIATE')
  try {
    const existing = db.get<DbAuthUser>(
      [
        'SELECT id, username, password_hash, password_salt, password_kdf_params, disabled_at',
        'FROM auth_users',
        'WHERE username = ?',
        'LIMIT 1',
      ].join('\n'),
      [normalized],
    )

    let userId: number

    if (!existing) {
      const createdAt = nowIso()
      const record = createPasswordRecord(password)

      db.run(
        [
          'INSERT INTO auth_users (username, password_hash, password_salt, password_kdf, password_kdf_params, created_at, updated_at, disabled_at)',
          'VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
        ].join('\n'),
        [
          normalized,
          record.passwordHash,
          record.passwordSalt,
          record.passwordKdf,
          record.passwordKdfParams,
          createdAt,
          createdAt,
        ],
      )

      const createdUser = db.get<{ id: number }>(
        'SELECT id FROM auth_users WHERE username = ? LIMIT 1',
        [normalized],
      )
      if (!createdUser) {
        throw new Error('failed to create user')
      }
      userId = createdUser.id
    } else {
      if (existing.disabled_at) {
        throw new Error('user is disabled')
      }

      const ok = verifyPassword(password, existing)
      if (!ok) {
        throw new Error('invalid username or password')
      }

      userId = existing.id
    }

    revokeCurrentSession(db, nowIso())
    createCurrentSession(db, userId)

    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }

  return {
    isAuthenticated: true,
    user: { username: normalized },
  }
}

export function logout(db: DataBase): void {
  revokeCurrentSession(db, nowIso())
}
