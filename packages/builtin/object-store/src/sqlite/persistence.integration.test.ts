import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, expect, it } from 'vitest'

import { createFileSystemCas } from '@repo/cas/node'
import type { ConnectionOptions } from '@repo/sqlite'
import { openTestDatabase } from '@repo/sqlite/testing'

import { createObjectStore, ObjectStoreError } from '../index'
import { createSqliteObjectIndex } from './index'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function createTestStorage() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'object-store-'))
  cleanups.push(() => fs.rm(root, { recursive: true, force: true }))
  const databasePath = path.join(root, 'index.db')
  const cas = createFileSystemCas(path.join(root, 'blobs'))
  const open = (connection?: ConnectionOptions) => {
    const database = openTestDatabase(databasePath, connection)
    let closed = false
    const close = async () => {
      if (!closed) {
        database.close()
        closed = true
      }
    }
    cleanups.push(close)
    const store = createObjectStore({ cas, index: createSqliteObjectIndex(database) })
    return { database, store, close }
  }
  return { cas, open }
}

it('filesystemとindexを再オープンし、複数接続の競合とpageをまたぐ列挙を扱う', async () => {
  const { cas, open } = await createTestStorage()
  const first = open()
  const content = new Uint8Array([1, 2, 3])
  const original = await first.store.put({
    key: 'persistent/画像?#%',
    content,
    metadata: { fileName: '画像.png' },
  })
  await first.close()
  const reopened = open()
  const other = open()
  await expect(reopened.store.find(original.object.key)).resolves.toEqual(original.object)
  await expect(reopened.store.read(original.object.key)).resolves.toEqual(content)
  const updates = await Promise.allSettled(
    [reopened, other].map(({ store }, i) =>
      store.updateMetadata({
        key: original.object.key,
        expectedRevision: original.object.revision,
        metadata: { fileName: `${i}.png` },
      }),
    ),
  )
  expect(updates.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  expect(updates.filter((result) => result.status === 'rejected')).toMatchObject([
    { reason: { code: 'revision-conflict' } },
  ])
  for (let i = 0; i < 105; i++)
    await reopened.store.put({ key: `page/${String(i).padStart(3, '0')}`, content })
  const listed = await collectItems(reopened.store.list())
  expect(listed).toHaveLength(106)
  expect(new Set(listed.map((object) => object.key)).size).toBe(106)
  expect(await cas.list()).toHaveLength(1)
  expect(
    reopened.database.get(
      'SELECT typeof(sha256) AS type, length(sha256) AS size FROM object_store_entry LIMIT 1',
    ),
  ).toEqual({ type: 'blob', size: 32 })
  const beforeReopen = await reopened.store.find(original.object.key)
  await reopened.store.remove(original.object.key)
  await reopened.close()
  await other.close()
  const afterReopen = open()
  const recreated = await afterReopen.store.put({ key: original.object.key, content })
  expect(recreated.object.revision).not.toBe(beforeReopen?.revision)
  await expect(
    afterReopen.store.updateMetadata({
      key: original.object.key,
      expectedRevision: original.object.revision,
      metadata: {},
    }),
  ).rejects.toMatchObject({ code: 'revision-conflict' })
})

it('未知のindex schema versionを暗黙に更新しない', () => {
  const database = openTestDatabase()
  try {
    createSqliteObjectIndex(database)
    database.exec('UPDATE object_store_schema SET version = 99')
    expect(() => createSqliteObjectIndex(database)).toThrow('未対応')
  } finally {
    database.close()
  }
})

it('非BMP文字と正規化形式の異なるキーを区別し、再オープン後も元の文字列で取得する', async () => {
  const { open } = await createTestStorage()
  const first = open()
  const keys = [
    'emoji/😀',
    'names/𠮷',
    'accent/é',
    'accent/e\u0301',
    'A',
    'a',
    ' key',
    'key ',
    'あ'.repeat(341) + 'a',
    '😀'.repeat(256),
  ]
  for (const [i, key] of keys.entries())
    await first.store.put({ key, content: new Uint8Array([i]) })
  await first.close()
  const reopened = open()
  for (const [i, key] of keys.entries()) {
    await expect(reopened.store.find(key)).resolves.toMatchObject({ key })
    await expect(reopened.store.read(key)).resolves.toEqual(new Uint8Array([i]))
  }
  expect(new Set((await collectItems(reopened.store.list())).map((object) => object.key))).toEqual(
    new Set(keys),
  )
})

it('外側の読み取りtransactionを昇格できない場合はkey-conflictにせずDBエラーを返す', async () => {
  const { open } = await createTestStorage()
  const first = open({ journalMode: 'wal', busyTimeoutMs: 0 })
  const second = open()
  const original = await first.store.put({ key: 'shared', content: new Uint8Array([1]) })
  first.database.exec('BEGIN')
  try {
    await first.store.find('shared')
    await second.store.updateMetadata({
      key: 'shared',
      expectedRevision: original.object.revision,
      metadata: { fileName: 'new snapshot' },
    })
    const failure: unknown = await first.store
      .put({ key: 'new', content: new Uint8Array([2]) })
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(ObjectStoreError)
    expect(failure).toMatchObject({ message: expect.stringMatching(/locked|busy/i) })
  } finally {
    first.database.exec('ROLLBACK')
  }
  await expect(first.store.find('new')).resolves.toBeNull()
  await expect(first.store.find('shared')).resolves.toMatchObject({
    metadata: { fileName: 'new snapshot' },
  })
})

async function collectItems<T>(items: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []
  for await (const item of items) result.push(item)
  return result
}
