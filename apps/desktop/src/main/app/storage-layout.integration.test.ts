import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { BrowserWindow } from 'electron'

import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { createAppAssetRootRegistry, handleAppAssetProtocol } from '@repo/asset-protocol'
import { openNodeDatabase } from '@repo/sqlite/node'
import { getStorageDemoApi } from '@your-app-name/api/storage-demo'

import {
  createStorageDemoRuntime,
  resolveStorageDemoStoragePaths,
} from '../features/storage-demo/runtime'
import { storageDemoSchemaVersion } from '../features/storage-demo/schema'
import { createApiFeature } from './create-api-feature'
import { createAppRuntime } from './create-app-runtime'

const electronHost = vi.hoisted(() => ({
  homePath: '',
  getPath: vi.fn<(name: string) => string>(),
}))
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: electronHost.getPath },
  safeStorage: {
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (encrypted: Buffer) => encrypted.toString(),
  },
}))

const ragHost = vi.hoisted(() => ({ ingestDocuments: vi.fn() }))
vi.mock('@repo/ai/ollama/rag', () => ({
  ingestDocuments: ragHost.ingestDocuments,
  retrieveRagContext: vi.fn(),
}))

const cleanups: Array<() => Promise<unknown>> = []

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  electronHost.homePath = await fs.mkdtemp(path.join(os.tmpdir(), 'app-storage-layout-'))
  const homePath = electronHost.homePath
  cleanups.push(() => fs.rm(homePath, { recursive: true, force: true }))
  electronHost.getPath.mockReset()
  electronHost.getPath.mockImplementation((name) => {
    if (name === 'home') {
      return homePath
    }
    throw new Error(`想定外の保存先の参照: ${name}`)
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

/** 実際の組み立て経路で runtime を作成し、テスト終了時に破棄する。 */
async function startRuntime() {
  const appRuntime = await createAppRuntime({ dirname: path.resolve('test', 'dist', 'main') })
  cleanups.push(() => appRuntime.dispose())
  const win = { once: vi.fn() } as unknown as BrowserWindow
  return {
    appRuntime,
    apiContext: createApiFeature({ appRuntime }).createWindowContext({ win }),
  }
}

/** ディレクトリ以下のファイルを相対パスで列挙する。SQLiteの一時ファイルとCASの本文は対象外。 */
async function listStoredFiles(root: string) {
  const entries = await fs.readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .filter((file) => !/-(wal|shm)$/.test(file) && !file.split(path.sep).includes('blobs'))
    .sort()
}

it('新規起動で各機能の保存先を共有データとElectron固有データに分け、保存した本文を配信する', async () => {
  // Arrange
  const storageRoot = path.join(electronHost.homePath, '.your-app-name')
  const { appRuntime, apiContext } = await startRuntime()

  // Act
  await appRuntime.secretStorage.storeSecret('TEST_KEY', 'secret')
  apiContext.auth.getRuntime().getStatus()
  await apiContext.todo.getService()
  await apiContext.aiChat.ingestDocument('本文')
  const ragDbPath = ragHost.ingestDocuments.mock.lastCall?.[1].dbPath
  const storageDemo = getStorageDemoApi(() => apiContext.storageDemo)
  const { url } = await storageDemo.objects.put(undefined)({
    key: 'sample',
    content: new TextEncoder().encode('hello'),
    mediaType: 'text/plain',
    fileName: 'sample.txt',
  })
  await storageDemo.tables.list(undefined)()
  const response = await handleAppAssetProtocol(new Request(url), appRuntime.appAssetRoots)
  const content = await response.text()

  // Assert: ログは非同期で開かれるため、作成を待ってから配置全体を確認する
  await vi.waitFor(() => fs.access(path.join(storageRoot, 'electron', 'log.txt')))
  expect(electronHost.getPath.mock.calls).toEqual([['home']])
  expect(await fs.readdir(electronHost.homePath)).toEqual(['.your-app-name'])
  expect((await fs.readdir(storageRoot)).sort()).toEqual(['app-data', 'electron'])
  expect(await listStoredFiles(path.join(storageRoot, 'app-data'))).toEqual([
    path.join('storage-demo', `demo-schema-${storageDemoSchemaVersion}.db`),
    path.join('storage-demo', 'object-store', 'index.db'),
  ])
  expect(await listStoredFiles(path.join(storageRoot, 'electron'))).toEqual([
    'auth.db',
    'log.txt',
    path.join('secrets', 'TEST_KEY.enc'),
    'todo.db',
  ])
  expect(ragDbPath).toBe(path.join(storageRoot, 'electron', 'sample-rag.db'))
  expect(content).toBe('hello')
})

it('手動移行の対応表どおりに配置した既存データを再オープンして取得・配信する', async () => {
  // Arrange: 旧基点に作成した storage-demo/ 全体と secrets/ 全体を、停止後に新しい基点へ配置する
  const storageRoot = path.join(electronHost.homePath, '.your-app-name')
  const legacyRoot = path.join(electronHost.homePath, 'legacy-user-data', 'app')
  const legacyRuntime = createStorageDemoRuntime({
    paths: resolveStorageDemoStoragePaths(legacyRoot),
    openDatabase: (filePath, connection) => openNodeDatabase(filePath, { connection }),
    objectDeliveryRegistry: createAppAssetRootRegistry([]),
  })
  const saved = await (
    await legacyRuntime.getService()
  ).objects.put({
    key: 'sample',
    content: new TextEncoder().encode('hello'),
    mediaType: 'text/plain',
    fileName: 'sample.txt',
  })
  await legacyRuntime.dispose()
  await fs.mkdir(path.join(legacyRoot, 'secrets'))
  await fs.writeFile(path.join(legacyRoot, 'secrets', 'TEST_KEY.enc'), 'secret')
  await fs.cp(
    path.join(legacyRoot, 'storage-demo'),
    path.join(storageRoot, 'app-data', 'storage-demo'),
    { recursive: true },
  )
  await fs.cp(path.join(legacyRoot, 'secrets'), path.join(storageRoot, 'electron', 'secrets'), {
    recursive: true,
  })

  // Act
  const { appRuntime, apiContext } = await startRuntime()
  const storageDemo = getStorageDemoApi(() => apiContext.storageDemo)
  const restored = (await storageDemo.objects.list(undefined)()).find(
    (object) => object.key === 'sample',
  )
  const response = await handleAppAssetProtocol(
    new Request(restored!.url),
    appRuntime.appAssetRoots,
  )
  const content = await response.text()
  const secret = await appRuntime.secretStorage.retrieveSecret('TEST_KEY')

  // Assert
  expect(restored?.revision).toBe(saved.revision)
  expect(content).toBe('hello')
  expect(secret).toBe('secret')
})
