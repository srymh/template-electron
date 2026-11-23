import { afterAll, afterEach, expect, it, vi } from 'vitest'

import { runInTransaction } from './index'
import { openTestDatabase } from './testing'

const database = openTestDatabase()
afterAll(() => database.close())
afterEach(() => {
  vi.restoreAllMocks()
  database.exec('DROP TABLE IF EXISTS entry')
})

it('戻り値を返し、成功時だけ変更をcommitする', () => {
  database.exec('CREATE TABLE entry (id INTEGER PRIMARY KEY)')
  expect(
    runInTransaction(database, () => {
      database.run('INSERT INTO entry VALUES (1)')
      return 42
    }),
  ).toBe(42)
  expect(database.query('SELECT * FROM entry')).toEqual([{ id: 1 }])
})

it('callbackの例外で変更を戻し、同じ接続を再利用できる', () => {
  database.exec('CREATE TABLE entry (id INTEGER PRIMARY KEY)')
  const failure = new Error('failed')
  expect(() =>
    runInTransaction(database, () => {
      database.run('INSERT INTO entry VALUES (1)')
      throw failure
    }),
  ).toThrow(failure)
  expect(database.query('SELECT * FROM entry')).toEqual([])
  runInTransaction(database, () => database.run('INSERT INTO entry VALUES (2)'))
  expect(database.query('SELECT * FROM entry')).toEqual([{ id: 2 }])
})

it('遅延外部キー制約によるcommit失敗でもrollbackする', () => {
  database.exec(
    'CREATE TABLE entry (id INTEGER PRIMARY KEY, parent INTEGER REFERENCES entry(id) DEFERRABLE INITIALLY DEFERRED)',
  )
  expect(() =>
    runInTransaction(database, () => database.run('INSERT INTO entry VALUES (1, 2)')),
  ).toThrow(/FOREIGN KEY/)
  expect(database.query('SELECT * FROM entry')).toEqual([])
})

it('SQLiteの自動rollbackで後始末が失敗しても元の例外を維持する', () => {
  database.exec(`CREATE TABLE entry (id INTEGER PRIMARY KEY);
    CREATE TRIGGER fail BEFORE INSERT ON entry BEGIN SELECT RAISE(ROLLBACK, 'original failure'); END;`)
  expect(() =>
    runInTransaction(database, () => database.run('INSERT INTO entry VALUES (1)')),
  ).toThrow('original failure')
  runInTransaction(database, () => database.exec('DROP TRIGGER fail'))
})

it('BEGIN失敗で外側のtransactionをrollbackしない', () => {
  database.exec('BEGIN')
  try {
    database.exec('CREATE TABLE entry (id INTEGER PRIMARY KEY)')
    expect(() => runInTransaction(database, () => {})).toThrow(/transaction/)
    database.run('INSERT INTO entry VALUES (1)')
    database.exec('COMMIT')
    expect(database.query('SELECT * FROM entry')).toEqual([{ id: 1 }])
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
})

it('thenableをcommitせず拒否する', () => {
  database.exec('CREATE TABLE entry (id INTEGER PRIMARY KEY)')
  expect(() =>
    runInTransaction(database, () => {
      database.run('INSERT INTO entry VALUES (1)')
      // oxlint-disable-next-line unicorn/no-thenable -- 実行時のthenable拒否を検証する。
      return { then: () => {} }
    }),
  ).toThrow('synchronous')
  expect(database.query('SELECT * FROM entry')).toEqual([])
})

it.each(['deferred', 'immediate', 'exclusive'] as const)('%sを利用できる', (mode) => {
  expect(runInTransaction(database, () => 'done', { mode })).toBe('done')
})

it('型付き利用ではPromiseを返せない', () => {
  const runAsync = () => {
    // @ts-expect-error 同期transactionへ非同期callbackを渡せない。
    return runInTransaction(database, async () => 1)
  }
  expect(runAsync).toThrow('synchronous')
})
