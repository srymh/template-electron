import { afterEach, describe, expect, it } from 'vitest'

import { createMemoryObjectStore } from '@repo/object-store/testing'
import { createSQLiteTableEditor } from '@repo/sqlite-table-editor'
import { openTestDatabase } from '@repo/sqlite/testing'

import { initializeStorageDemoSchema, storageDemoTableRegistry } from './schema'
import { createStorageDemoService } from './service'

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
})

/** 見本の行を持つデモ用 DB とメモリのオブジェクトストアで、上限を小さくした service を作る。 */
function setupService(limits: { objects?: number; rowsPerTable?: number }) {
  const database = openTestDatabase(':memory:', { foreignKeys: true })
  cleanups.push(() => database.close())
  initializeStorageDemoSchema(database)
  return createStorageDemoService({
    objectStore: createMemoryObjectStore(),
    tableEditor: createSQLiteTableEditor(database, storageDemoTableRegistry),
    createObjectUrl: async ({ key, revision }) => `app-asset://test/${key}?revision=${revision}`,
    limits,
  })
}

/** 指定したキーで小さな本文を保存する入力。 */
const objectInput = (key: string) => ({
  key,
  content: new TextEncoder().encode(key),
  mediaType: 'text/plain',
  fileName: null,
})

describe('createStorageDemoService の件数の上限', () => {
  it('オブジェクトが上限の件数に達したら、新しいキーの保存を拒否する', async () => {
    // Arrange
    const service = setupService({ objects: 2 })
    await service.objects.put(objectInput('a'))
    await service.objects.put(objectInput('b'))

    // Act
    const overLimit = service.objects.put(objectInput('c'))

    // Assert
    await expect(overLimit).rejects.toThrow('2件まで')
    expect((await service.objects.list()).map(({ key }) => key)).toEqual(['a', 'b'])
  })

  it('上限の件数に達していても、既存キーの再保存と削除後の保存は受け付ける', async () => {
    // Arrange
    const service = setupService({ objects: 2 })
    await service.objects.put(objectInput('a'))
    await service.objects.put(objectInput('b'))

    // Act
    const resaved = await service.objects.put(objectInput('a'))
    await service.objects.remove({ key: 'b' })
    const afterRemove = await service.objects.put(objectInput('c'))

    // Assert
    expect(resaved.key).toBe('a')
    expect(afterRemove.key).toBe('c')
    expect((await service.objects.list()).map(({ key }) => key)).toEqual(['a', 'c'])
  })

  it('行が上限の件数に達したテーブルには追加せず、一覧を取得できる状態を保つ', async () => {
    // Arrange: 見本の2行に1行足して、上限の3行にする
    const service = setupService({ rowsPerTable: 3 })
    await service.tables.createRow({
      tableName: 'demo_item',
      row: { id: 3, title: '3行目', status: 'draft' },
    })

    // Act
    const overLimit = service.tables.createRow({
      tableName: 'demo_item',
      row: { id: 4, title: '4行目', status: 'draft' },
    })

    // Assert
    await expect(overLimit).rejects.toThrow('3行まで')
    const rows = await service.tables.listRows({ tableName: 'demo_item' })
    expect(rows.rows.map(({ id }) => id)).toEqual([1, 2, 3])
  })

  it('行の上限はテーブルごとに数える', async () => {
    // Arrange: 項目を上限の3行にしても、2行の分類には追加できる
    const service = setupService({ rowsPerTable: 3 })
    await service.tables.createRow({
      tableName: 'demo_item',
      row: { id: 3, title: '3行目', status: 'draft' },
    })

    // Act
    const created = await service.tables.createRow({
      tableName: 'demo_category',
      row: { id: 3, name: '動画' },
    })

    // Assert
    expect(created.row).toEqual({ id: 3, name: '動画' })
  })
})
