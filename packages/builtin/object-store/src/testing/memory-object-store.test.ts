import { expect, it } from 'vitest'

import { createMemoryObjectStore } from './index'

it('保存した本文とmetadataをキーで取得できる', async () => {
  // Arrange
  const store = createMemoryObjectStore()
  const content = new Uint8Array([1, 2, 3])
  const metadata = { mediaType: 'image/png', fileName: 'sample.png' }

  // Act
  const saved = await store.put({ key: 'images/sample', content, metadata })
  const object = await store.find('images/sample')
  const bytes = await store.read('images/sample')

  // Assert
  expect(saved.created).toBe(true)
  expect(object).toEqual(saved.object)
  expect(object?.metadata).toMatchObject(metadata)
  expect(bytes).toEqual(content)
})

it('別インスタンスの本文とキーindexを共有しない', async () => {
  // Arrange
  const first = createMemoryObjectStore()
  const second = createMemoryObjectStore()

  // Act
  await first.put({ key: 'same', content: new Uint8Array([1]) })
  const secondBeforePut = await second.find('same')
  await second.put({ key: 'same', content: new Uint8Array([2]) })
  await first.remove('same')
  const secondContent = await second.read('same')
  const secondVerification = await second.verify('same')

  // Assert
  expect(secondBeforePut).toBeNull()
  expect(secondContent).toEqual(new Uint8Array([2]))
  expect(secondVerification).toMatchObject({ status: 'valid' })
})
