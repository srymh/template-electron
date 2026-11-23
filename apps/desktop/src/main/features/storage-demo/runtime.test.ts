import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createAppAssetRootRegistry, handleAppAssetProtocol } from '@repo/asset-protocol'
import { openNodeDatabase } from '@repo/sqlite/node'

import { objectDeliveryRootId } from './object-delivery'
import {
  createStorageDemoRuntime,
  resolveStorageDemoStoragePaths,
  storageDemoDisposedMessage,
} from './runtime'

const cleanups: Array<() => Promise<unknown> | void> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

/** 一時ディレクトリを保存先にした runtime を作り、テスト終了時に破棄する。 */
async function setupRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-demo-runtime-'))
  cleanups.push(() => fs.rm(root, { recursive: true, force: true }))
  const roots = createAppAssetRootRegistry([])
  const paths = resolveStorageDemoStoragePaths(root)
  const createRuntime = () => {
    const runtime = createStorageDemoRuntime({
      paths,
      openDatabase: (filePath, connection) => openNodeDatabase(filePath, { connection }),
      objectDeliveryRegistry: roots,
    })
    cleanups.push(() => runtime.dispose())
    return runtime
  }
  return { root, roots, paths, createRuntime }
}

describe('createStorageDemoRuntime', () => {
  it('作成しただけでは保存先を作らず、配信rootだけを登録する', async () => {
    // Arrange
    const { root, roots, createRuntime } = await setupRuntime()

    // Act
    createRuntime()
    const entries = await fs.readdir(root)

    // Assert
    expect(entries).toEqual([])
    expect(roots.get(objectDeliveryRootId)).toBeDefined()
  })

  it('保存したオブジェクトを一覧の URL から配信し、検証・削除できる', async () => {
    // Arrange
    const { roots, createRuntime } = await setupRuntime()
    const service = await createRuntime().getService()

    // Act
    const saved = await service.objects.put({
      key: 'notes/hello.txt',
      content: new TextEncoder().encode('hello'),
      mediaType: 'text/plain',
      fileName: 'hello.txt',
    })
    const listed = await service.objects.list()
    const response = await handleAppAssetProtocol(new Request(listed[0]!.url), roots)
    const content = await response.text()
    const verification = await service.objects.verify({ key: saved.key })
    const removed = await service.objects.remove({ key: saved.key })
    const afterRemove = await handleAppAssetProtocol(new Request(saved.url), roots)

    // Assert
    expect(listed).toEqual([saved])
    expect(saved).toMatchObject({
      key: 'notes/hello.txt',
      byteSize: 5,
      mediaType: 'text/plain',
      fileName: 'hello.txt',
    })
    expect(content).toBe('hello')
    expect(verification).toBe('valid')
    expect(removed).toBe(true)
    expect(afterRemove.status).toBe(404)
  })

  it('見本の行を持つデモ用テーブルの定義と、許可値・参照先の候補を返す', async () => {
    // Arrange
    const service = await (await setupRuntime()).createRuntime().getService()

    // Act
    const definitions = await service.tables.list()
    const items = await service.tables.listRows({ tableName: 'demo_item' })
    const itemDefinition = definitions.find(({ tableName }) => tableName === 'demo_item')
    const status = itemDefinition?.columns.find(({ name }) => name === 'status')
    const category = itemDefinition?.columns.find(({ name }) => name === 'category_id')

    // Assert
    expect(definitions.map(({ tableName }) => tableName)).toEqual(['demo_category', 'demo_item'])
    expect(items.rows).toHaveLength(2)
    expect(items.rowLabels[0]).toEqual({ category_id: '資料' })
    expect(status?.allowedValues).toEqual(['draft', 'published', 'archived'])
    expect(category?.allowedValueOptions).toEqual([
      { value: null, label: '未分類' },
      { value: 1, label: '資料' },
      { value: 2, label: '画像' },
    ])
  })

  it('行を追加・更新・削除し、参照されている行の削除は外部キー制約で拒否する', async () => {
    // Arrange
    const service = await (await setupRuntime()).createRuntime().getService()

    // Act
    const created = await service.tables.createRow({
      tableName: 'demo_item',
      row: { id: 3, title: '追加した項目', status: 'draft', category_id: null, note: null },
    })
    const updated = await service.tables.updateRow({
      tableName: 'demo_item',
      key: { id: 3 },
      changes: { status: 'archived' },
    })
    const removed = await service.tables.removeRow({ tableName: 'demo_item', key: { id: 3 } })
    const referencedRemoval = service.tables.removeRow({
      tableName: 'demo_category',
      key: { id: 1 },
    })

    // Assert
    expect(created.row).toMatchObject({ id: 3, title: '追加した項目' })
    expect(updated).toMatchObject({ changed: true, after: { status: 'archived' } })
    expect(removed.removed).toBe(true)
    await expect(referencedRemoval).rejects.toThrow()
  })

  it('許可されていない値での更新を拒否する', async () => {
    // Arrange
    const service = await (await setupRuntime()).createRuntime().getService()

    // Act
    const update = service.tables.updateRow({
      tableName: 'demo_item',
      key: { id: 1 },
      changes: { status: 'unknown' },
    })

    // Assert
    await expect(update).rejects.toThrow()
  })

  it('破棄後に開き直すと保存済みの行とオブジェクトを読み出せる', async () => {
    // Arrange
    const { createRuntime } = await setupRuntime()
    const first = createRuntime()
    const firstService = await first.getService()
    await firstService.objects.put({
      key: 'sample',
      content: new Uint8Array([1, 2, 3]),
      mediaType: null,
      fileName: null,
    })
    await firstService.tables.updateRow({
      tableName: 'demo_category',
      key: { id: 1 },
      changes: { name: '文書' },
    })
    await first.dispose()

    // Act
    const reopened = await createRuntime().getService()
    const objects = await reopened.objects.list()
    const categories = await reopened.tables.listRows({ tableName: 'demo_category' })

    // Assert
    expect(objects.map(({ key, byteSize }) => ({ key, byteSize }))).toEqual([
      { key: 'sample', byteSize: 3 },
    ])
    expect(categories.rows[0]).toEqual({ id: 1, name: '文書' })
  })

  it('破棄すると配信rootを解除し、以後のservice取得を拒否する', async () => {
    // Arrange
    const { roots, createRuntime } = await setupRuntime()
    const runtime = createRuntime()
    await runtime.getService()

    // Act
    await runtime.dispose()

    // Assert
    expect(roots.get(objectDeliveryRootId)).toBeUndefined()
    await expect(runtime.getService()).rejects.toThrow(storageDemoDisposedMessage)
  })
})
