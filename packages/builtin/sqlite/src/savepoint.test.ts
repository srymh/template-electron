import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { runInSavepoint, runInTransaction, runWithRollback } from './index'
import type { Database } from './index'
import { openTestDatabase } from './testing'

let database: Database
beforeEach(() => {
  database = openTestDatabase()
  database.exec('CREATE TABLE entry (id INTEGER PRIMARY KEY)')
})
afterEach(() => {
  vi.restoreAllMocks()
  database.close()
})

it('外側transactionなしでは成功時にcommitし、結果を返す', () => {
  expect(
    runInSavepoint(database, () => {
      database.run('INSERT INTO entry VALUES (1)')
      return { id: 1 }
    }),
  ).toEqual({ id: 1 })
  expect(database.query('SELECT * FROM entry')).toEqual([{ id: 1 }])
  // 接続に未完のtransactionを残さない。
  runInTransaction(database, () => {})
})

it('外側transactionを確定せず、そのrollbackで変更が戻る', () => {
  database.exec('BEGIN')
  database.run('INSERT INTO entry VALUES (1)')
  runInSavepoint(database, () => database.run('INSERT INTO entry VALUES (2)'))
  database.exec('ROLLBACK')
  expect(database.query('SELECT * FROM entry')).toEqual([])
})

it('内側の失敗だけを戻し、外側の処理を継続できる', () => {
  const failure = new Error('inner failure')
  runInSavepoint(database, () => {
    database.run('INSERT INTO entry VALUES (1)')
    expect(() =>
      runInSavepoint(database, () => {
        database.run('INSERT INTO entry VALUES (2)')
        throw failure
      }),
    ).toThrow(failure)
    database.run('INSERT INTO entry VALUES (3)')
  })
  expect(database.query('SELECT * FROM entry ORDER BY id')).toEqual([{ id: 1 }, { id: 3 }])
})

it('内側で成功しても外側の失敗で一緒に戻す', () => {
  expect(() =>
    runInSavepoint(database, () => {
      runInSavepoint(database, () => database.run('INSERT INTO entry VALUES (1)'))
      throw new Error('outer failure')
    }),
  ).toThrow('outer failure')
  expect(database.query('SELECT * FROM entry')).toEqual([])
})

it('SQLiteの自動rollbackでsavepointが消えても発端の例外を維持する', () => {
  database.exec(
    `CREATE TRIGGER fail BEFORE INSERT ON entry BEGIN SELECT RAISE(ROLLBACK, 'original failure'); END`,
  )
  expect(() =>
    runInSavepoint(database, () => database.run('INSERT INTO entry VALUES (1)')),
  ).toThrow('original failure')
  database.exec('DROP TRIGGER fail')
  runInSavepoint(database, () => database.run('INSERT INTO entry VALUES (2)'))
  expect(database.query('SELECT * FROM entry')).toEqual([{ id: 2 }])
})

it('release時の遅延制約違反でも変更を戻し、接続を再利用できる', () => {
  database.exec(
    'CREATE TABLE child (parent INTEGER REFERENCES entry(id) DEFERRABLE INITIALLY DEFERRED)',
  )
  expect(() =>
    runInSavepoint(database, () => database.run('INSERT INTO child VALUES (1)')),
  ).toThrow(/FOREIGN KEY/)
  expect(database.query('SELECT * FROM child')).toEqual([])
  runInTransaction(database, () => {})
})

it('savepoint開始失敗ではcallbackを実行せず、外側を後始末しない', () => {
  database.exec('BEGIN')
  database.run('INSERT INTO entry VALUES (1)')
  const exec = database.exec.bind(database)
  const spy = vi.spyOn(database, 'exec').mockImplementation((sql) => {
    if (sql.startsWith('SAVEPOINT')) throw new Error('start failed')
    exec(sql)
  })
  const operation = vi.fn()
  expect(() => runInSavepoint(database, operation)).toThrow('start failed')
  expect(operation).not.toHaveBeenCalled()
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
  database.exec('COMMIT')
  expect(database.query('SELECT * FROM entry')).toEqual([{ id: 1 }])
})

it('rollback失敗時にRELEASEせず、部分的な更新をcommitしない', () => {
  const failure = new Error('operation failed')
  const exec = database.exec.bind(database)
  const spy = vi.spyOn(database, 'exec').mockImplementation((sql) => {
    if (sql.startsWith('ROLLBACK TO')) throw new Error('cleanup failed')
    exec(sql)
  })
  expect(() =>
    runInSavepoint(database, () => {
      database.run('INSERT INTO entry VALUES (1)')
      throw failure
    }),
  ).toThrow(failure)
  expect(spy.mock.calls.some(([sql]) => sql.startsWith('RELEASE'))).toBe(false)
  spy.mockRestore()
  database.exec('ROLLBACK')
  expect(database.query('SELECT * FROM entry')).toEqual([])
})

it.each([true, false])('結果に応じてrollbackを選択できる: %s', (rollback) => {
  expect(
    runInSavepoint(
      database,
      () => {
        database.run('INSERT INTO entry VALUES (1)')
        return { rollback }
      },
      { rollbackWhen: (result) => result.rollback },
    ),
  ).toEqual({ rollback })
  expect(database.query('SELECT * FROM entry')).toEqual(rollback ? [] : [{ id: 1 }])
})

it('rollback条件の判定に失敗しても変更を戻す', () => {
  expect(() =>
    runInSavepoint(database, () => database.run('INSERT INTO entry VALUES (1)'), {
      rollbackWhen: () => {
        throw new Error('decision failed')
      },
    }),
  ).toThrow('decision failed')
  expect(database.query('SELECT * FROM entry')).toEqual([])
})

it('常にrollbackする処理は結果を返し、外側の変更だけを残す', () => {
  database.exec('BEGIN')
  database.run('INSERT INTO entry VALUES (1)')
  const result = runWithRollback(database, () => {
    database.run('INSERT INTO entry VALUES (2)')
    return database.query('SELECT * FROM entry ORDER BY id')
  })
  expect(result).toEqual([{ id: 1 }, { id: 2 }])
  database.exec('COMMIT')
  expect(database.query('SELECT * FROM entry')).toEqual([{ id: 1 }])
})

it('常にrollbackする処理はcallback失敗時も変更を戻す', () => {
  expect(() =>
    runWithRollback(database, () => {
      database.run('INSERT INTO entry VALUES (1)')
      throw new Error('operation failed')
    }),
  ).toThrow('operation failed')
  expect(database.query('SELECT * FROM entry')).toEqual([])
})

it('成功後の必須rollbackに失敗した場合は成功結果を返さない', () => {
  const exec = database.exec.bind(database)
  const spy = vi.spyOn(database, 'exec').mockImplementation((sql) => {
    if (sql.startsWith('ROLLBACK TO')) throw new Error('rollback failed')
    exec(sql)
  })
  expect(() =>
    runWithRollback(database, () => database.run('INSERT INTO entry VALUES (1)')),
  ).toThrow('rollback failed')
  expect(spy.mock.calls.some(([sql]) => sql.startsWith('RELEASE'))).toBe(false)
})

it('非同期callbackを型と実行時の両方で拒否する', () => {
  const runAsync = () => {
    // @ts-expect-error Promiseを返すcallbackは同期境界で使用できない。
    return runInSavepoint(database, async () => 1)
  }
  const rollbackAsync = () => {
    // @ts-expect-error 常にrollbackする境界も同期専用。
    return runWithRollback(database, async () => 1)
  }
  expect(runAsync).toThrow('synchronous')
  expect(rollbackAsync).toThrow('synchronous')
  runInTransaction(database, () => {})
})
