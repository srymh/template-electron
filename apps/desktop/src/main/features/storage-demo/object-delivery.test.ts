import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, expect, it, vi } from 'vitest'

import { createAppAssetRootRegistry, handleAppAssetProtocol } from '@repo/asset-protocol'
import { createFileSystemCas } from '@repo/cas/node'
import { createObjectStore } from '@repo/object-store'
import { createSqliteObjectIndex } from '@repo/object-store/sqlite'
import { openTestDatabase } from '@repo/sqlite/testing'

import { createObjectDelivery, objectDeliveryRootId } from './object-delivery'

const cleanups: Array<() => Promise<void> | void> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

// 配信の契約には業務schemaとruntimeが不要なため、storeだけを直接準備する。
async function setupStoredObject(key = 'sample') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-demo-object-delivery-'))
  cleanups.push(() => fs.rm(root, { recursive: true, force: true }))
  const index = openTestDatabase()
  cleanups.push(() => index.close())
  const store = createObjectStore({
    cas: createFileSystemCas(path.join(root, 'blobs')),
    index: createSqliteObjectIndex(index),
  })
  const saved = await store.put({ key, content: new TextEncoder().encode('hello') })
  const roots = createAppAssetRootRegistry([])
  const getObjectStore = vi.fn(async () => store)
  const delivery = createObjectDelivery(roots, getObjectStore)
  cleanups.push(() => delivery.dispose())
  return { store, delivery, roots, saved, key, getObjectStore }
}

it('発行したURLへのアクセスで同じstoreの本文を配信する', async () => {
  // Arrange
  const { delivery, roots, saved, key } = await setupStoredObject('images/予定 ?#%.txt')

  // Act
  const url = await delivery.getUrl({ key, revision: saved.object.revision })
  const response = await handleAppAssetProtocol(new Request(url!), roots)
  const content = await response.text()

  // Assert
  expect(url).toBe(
    `app-asset://storage-demo-objects/objects/${key.split('/').map(encodeURIComponent).join('/')}?revision=${saved.object.revision}`,
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(content).toBe('hello')
})

it('createUrlはstoreを開かずに、revision条件付きのURLを組み立てる', async () => {
  // Arrange
  const { delivery, saved, key, getObjectStore } = await setupStoredObject('images/予定 ?#%.txt')
  const callsBefore = getObjectStore.mock.calls.length

  // Act
  const url = await delivery.createUrl({ key, revision: saved.object.revision })

  // Assert
  expect(url).toBe(
    `app-asset://storage-demo-objects/objects/${key.split('/').map(encodeURIComponent).join('/')}?revision=${saved.object.revision}`,
  )
  expect(getObjectStore.mock.calls.length).toBe(callsBefore)
})

it('createUrlで組み立てたURLは、配信時にrevisionが一致すれば本文を、一致しなければNot Foundを返す', async () => {
  // Arrange
  const { delivery, roots, saved, key } = await setupStoredObject()
  const currentUrl = await delivery.createUrl({ key, revision: saved.object.revision })
  const staleUrl = await delivery.createUrl({ key, revision: `${saved.object.revision}0` })

  // Act
  const current = await handleAppAssetProtocol(new Request(currentUrl), roots)
  const stale = await handleAppAssetProtocol(new Request(staleUrl), roots)

  // Assert
  expect(current.status).toBe(200)
  expect(await current.text()).toBe('hello')
  expect(stale.status).toBe(404)
})

it('createUrlは不正なrevisionを拒否する', async () => {
  // Arrange
  const { delivery, key } = await setupStoredObject()

  // Act / Assert
  await expect(delivery.createUrl({ key, revision: '' })).rejects.toThrow(TypeError)
})

it.each([
  ['空文字', '?revision='],
  ['値の省略', '?revision'],
  ['世代不一致', '?revision=wrong'],
  ['NUL', '?revision=%00'],
  ['長さ超過', '?revision=' + 'a'.repeat(257)],
  ['複数指定', null],
])('配信URLのrevisionが%sなら404を返す', async (_condition, search) => {
  // Arrange
  const { delivery, roots, key, saved } = await setupStoredObject()
  const url = await delivery.getUrl({ key })
  // 正しいrevisionを二重に指定し、単なる世代不一致で通る検証を避ける。
  const query = search ?? `?revision=${saved.object.revision}&revision=${saved.object.revision}`

  // Act
  const response = await handleAppAssetProtocol(new Request(url! + query), roots)

  // Assert
  expect(response.status).toBe(404)
})

it.each([
  { condition: '存在しないキー', input: { key: 'missing' } },
  { condition: '一致しないrevision', input: { key: 'sample', revision: 'other' } },
])('$conditionではURLを発行しない', async ({ input }) => {
  // Arrange
  const { delivery } = await setupStoredObject('sample')

  // Act
  const url = await delivery.getUrl(input)

  // Assert
  expect(url).toBeNull()
})

it.each([
  { condition: '空文字', revision: '' },
  { condition: '257文字', revision: 'a'.repeat(257) },
  { condition: 'NULを含む値', revision: 'a\0b' },
])('revisionが$conditionならstoreを取得せずにURLを発行しない', async ({ revision }) => {
  // Arrange
  const { delivery, getObjectStore, key } = await setupStoredObject()

  // Act
  const url = await delivery.getUrl({ key, revision })

  // Assert
  expect(url).toBeNull()
  expect(getObjectStore).not.toHaveBeenCalled()
})

it.each([
  { condition: '指定あり', strict: true },
  { condition: '指定なし', strict: false },
])('revision条件が$conditionでも解決後に世代が変わった本文を返さない', async ({ strict }) => {
  // Arrange: metadataを解決した後で、同じキーを別の本文に置き換える。
  const { roots, store, key, saved } = await setupStoredObject()
  const assetRoot = roots.getOrThrow(objectDeliveryRootId)
  if (assetRoot.resolution !== 'stream') {
    throw new Error('stream root expected')
  }
  const resolved = await assetRoot.resolveStream(
    `objects/${key}`,
    new URLSearchParams(strict ? { revision: saved.object.revision } : {}),
  )
  if (!resolved) {
    throw new Error('登録済みのオブジェクトを解決できませんでした。')
  }
  await store.remove(key)
  await store.put({ key, content: new TextEncoder().encode('world') })

  // Act / Assert
  await expect(resolved.read({ offset: 0, length: 5 })).rejects.toThrow(
    'オブジェクトが変更されました',
  )
})

it('破棄すると自身の配信rootだけを解除する', async () => {
  // Arrange
  const { delivery, roots } = await setupStoredObject()
  roots.register({ id: 'other-root', resolution: 'stream', resolveStream: async () => null })

  // Act
  delivery.dispose()
  const deliveryRoot = roots.get(objectDeliveryRootId)
  const otherRoot = roots.get('other-root')

  // Assert
  expect(deliveryRoot).toBeUndefined()
  expect(otherRoot).toBeDefined()
})
