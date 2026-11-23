import { afterEach, expect, it } from 'vitest'

import { createMemoryCas } from '@repo/cas/testing'
import type { Database } from '@repo/sqlite'
import { openTestDatabase } from '@repo/sqlite/testing'

import { createObjectStore } from '../index'
import { createSqliteObjectIndex } from './index'

const databases: Database[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

function setup() {
  const database = openTestDatabase()
  databases.push(database)
  const cas = createMemoryCas()
  const store = createObjectStore({ cas, index: createSqliteObjectIndex(database) })
  return { database, cas, store }
}

it('全キーで採番を共有し、JS安全整数を超えても文字列で正確に比較更新する', async () => {
  const { database, store } = setup()
  database.exec('UPDATE object_store_revision SET value = 9007199254740991')
  const a = await store.put({ key: 'a', content: new Uint8Array([1]) })
  const b = await store.put({ key: 'b', content: new Uint8Array([2]) })
  expect(a.object.revision).toBe('9007199254740992')
  expect(b.object.revision).toBe('9007199254740993')
  const updated = await store.updateMetadata({
    key: 'a',
    expectedRevision: a.object.revision,
    metadata: { fileName: 'new' },
  })
  expect(updated.revision).toBe('9007199254740994')
  await expect(
    store.updateMetadata({ key: 'a', expectedRevision: a.object.revision, metadata: {} }),
  ).rejects.toMatchObject({ code: 'revision-conflict' })
})

it('採番上限では更新を拒否し、内容・metadata・採番状態を保持する', async () => {
  const { database, store } = setup()
  const original = await store.put({ key: 'existing', content: new Uint8Array([1]) })
  database.exec('UPDATE object_store_revision SET value = 9223372036854775806')
  const last = await store.put({ key: 'last', content: new Uint8Array([1]) })
  expect(last.object.revision).toBe('9223372036854775807')
  await expect(store.put({ key: 'next', content: new Uint8Array([1]) })).rejects.toThrow(RangeError)
  await expect(
    store.updateMetadata({
      key: 'existing',
      expectedRevision: original.object.revision,
      metadata: { fileName: 'lost' },
    }),
  ).rejects.toThrow(RangeError)
  await expect(store.find('existing')).resolves.toEqual(original.object)
  await expect(store.find('next')).resolves.toBeNull()
  await expect(store.put({ key: 'last', content: new Uint8Array([1]) })).resolves.toEqual({
    created: false,
    object: last.object,
  })
  expect(database.get('SELECT CAST(value AS TEXT) AS value FROM object_store_revision')).toEqual({
    value: '9223372036854775807',
  })
})

it('レコード保存に失敗したら採番もrollbackし、更新前の状態を維持する', async () => {
  const { database, store } = setup()
  database.exec(
    `CREATE TRIGGER fail_create BEFORE INSERT ON object_store_entry BEGIN SELECT RAISE(ABORT, 'create failed'); END`,
  )
  await expect(store.put({ key: 'retry', content: new Uint8Array([1]) })).rejects.toThrow(
    'create failed',
  )
  expect(database.get('SELECT value FROM object_store_revision')).toEqual({ value: 0 })
  database.exec('DROP TRIGGER fail_create')
  const created = await store.put({ key: 'retry', content: new Uint8Array([1]) })
  expect(created.object.revision).toBe('1')
  database.exec(
    `CREATE TRIGGER fail_update BEFORE UPDATE ON object_store_entry BEGIN SELECT RAISE(ABORT, 'update failed'); END`,
  )
  await expect(
    store.updateMetadata({
      key: 'retry',
      expectedRevision: created.object.revision,
      metadata: { fileName: 'lost' },
    }),
  ).rejects.toThrow('update failed')
  expect(database.get('SELECT value FROM object_store_revision')).toEqual({ value: 1 })
  await expect(store.find('retry')).resolves.toEqual(created.object)
  database.exec('DROP TRIGGER fail_update')
  const updated = await store.updateMetadata({
    key: 'retry',
    expectedRevision: created.object.revision,
    metadata: {},
  })
  expect(updated.revision).toBe('2')
})

it('外側transactionのrollbackで行と採番が戻り、未commitのtokenは再利用され得る', async () => {
  const { database, store } = setup()
  const committed = await store.put({ key: 'committed', content: new Uint8Array([1]) })
  database.exec('BEGIN')
  const provisional = await store.put({ key: 'provisional', content: new Uint8Array([2]) })
  await store.updateMetadata({
    key: 'committed',
    expectedRevision: committed.object.revision,
    metadata: { fileName: 'provisional' },
  })
  database.exec('ROLLBACK')
  await expect(store.find('provisional')).resolves.toBeNull()
  await expect(store.find('committed')).resolves.toEqual(committed.object)
  expect(database.get('SELECT value FROM object_store_revision')).toEqual({ value: 1 })
  const next = await store.put({ key: 'next', content: new Uint8Array([3]) })
  // hostはprovisionalを確定結果として公開せず、rollback時に破棄する必要がある。
  expect(next.object.revision).toBe(provisional.object.revision)
})

it('外側transactionのcommit後は結果とrevisionを後続の比較更新に利用できる', async () => {
  const { database, store } = setup()
  database.exec('BEGIN')
  const provisional = await store.put({ key: 'committed', content: new Uint8Array([1]) })
  const matched = await store.put({ key: 'committed', content: new Uint8Array([1]) })
  expect(matched.object.revision).toBe(provisional.object.revision)
  database.exec('COMMIT')
  await expect(store.find('committed')).resolves.toEqual(provisional.object)
  const updated = await store.updateMetadata({
    key: 'committed',
    expectedRevision: provisional.object.revision,
    metadata: { fileName: 'committed' },
  })
  expect(updated.revision).not.toBe(provisional.object.revision)
})

it('一致・競合では採番せず、次の新規作成でだけrevisionを進める', async () => {
  const { database, store } = setup()
  const input = { key: 'original', content: new Uint8Array([1]) }
  const original = await store.put(input)
  await expect(store.put(input)).resolves.toEqual({ created: false, object: original.object })
  await expect(store.put({ ...input, metadata: { fileName: 'conflict' } })).rejects.toMatchObject({
    code: 'key-conflict',
  })
  expect(database.get('SELECT value FROM object_store_revision')).toEqual({ value: 1 })
  const next = await store.put({ key: 'next', content: new Uint8Array([2]) })
  expect(next.object.revision).toBe('2')
})

it('SQLiteがtransaction全体をrollbackしても後始末で元の例外を失わない', async () => {
  const { database, store } = setup()
  database.exec(
    `CREATE TRIGGER abort_transaction BEFORE INSERT ON object_store_entry BEGIN SELECT RAISE(ROLLBACK, 'transaction aborted'); END`,
  )
  await expect(store.put({ key: 'retry', content: new Uint8Array([1]) })).rejects.toThrow(
    'transaction aborted',
  )
  await expect(store.find('retry')).resolves.toBeNull()
  expect(database.get('SELECT value FROM object_store_revision')).toEqual({ value: 0 })
  database.exec('DROP TRIGGER abort_transaction')
  const retry = await store.put({ key: 'retry', content: new Uint8Array([1]) })
  expect(retry.object.revision).toBe('1')
})

it('schema初期化の途中失敗では部分的な作成をrollbackし、原因解消後に再実行できる', async () => {
  const database = openTestDatabase()
  databases.push(database)
  database.exec('CREATE TABLE object_store_revision (unrelated TEXT)')
  expect(() => createSqliteObjectIndex(database)).toThrow(/already exists/)
  expect(
    database.query(
      "SELECT name FROM sqlite_master WHERE name IN ('object_store_schema', 'object_store_entry')",
    ),
  ).toEqual([])
  database.exec('DROP TABLE object_store_revision')
  const store = createObjectStore({
    cas: createMemoryCas(),
    index: createSqliteObjectIndex(database),
  })
  const created = await store.put({ key: 'first', content: new Uint8Array([1]) })
  expect(created.object.revision).toBe('1')
})

it('キー変更と採番は外側rollbackで一緒に戻り、採番上限でも元の行を失わない', async () => {
  const { database, store } = setup()
  const original = (await store.put({ key: 'a', content: new Uint8Array([1]) })).object
  database.exec('BEGIN')
  await store.rename({ key: 'a', newKey: 'b', expectedRevision: original.revision })
  database.exec('ROLLBACK')
  expect(await store.find('a')).toEqual(original)
  expect(await store.find('b')).toBeNull()
  database.exec('UPDATE object_store_revision SET value = 9223372036854775807')
  await expect(
    store.rename({ key: 'a', newKey: 'b', expectedRevision: original.revision }),
  ).rejects.toThrow(RangeError)
  expect(await store.find('a')).toEqual(original)
  expect(await store.find('b')).toBeNull()
})

it('キー更新SQLの失敗では、先に行った採番もrollbackする', async () => {
  const { database, store } = setup()
  const original = (await store.put({ key: 'a', content: new Uint8Array([1]) })).object
  database.exec(
    "CREATE TRIGGER reject_key_update BEFORE UPDATE OF key ON object_store_entry BEGIN SELECT RAISE(ABORT, 'rejected'); END",
  )
  await expect(
    store.rename({ key: 'a', newKey: 'b', expectedRevision: original.revision }),
  ).rejects.toThrow('rejected')
  expect(await store.find('a')).toEqual(original)
  expect(await store.find('b')).toBeNull()
  expect(database.get('SELECT CAST(value AS TEXT) AS value FROM object_store_revision')).toEqual({
    value: original.revision,
  })
})
