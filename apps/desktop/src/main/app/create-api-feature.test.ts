import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { BrowserWindow, WebContents } from 'electron'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AiChatSession } from '@repo/ai/chat/session'

import type { Logger } from '../infra/logger'
import type { MainPaths } from '../infra/paths'
import type { SecretStorage } from '../infra/safe-storage'
import { ApiContextRegistry } from '../ipc/context-registry'
import { AppRuntime } from './app-runtime'
import { createApiFeature } from './create-api-feature'

vi.mock('electron', () => ({ nativeTheme: { themeSource: 'system' } }))
vi.mock('@repo/ai/ollama/rag', () => ({ ingestDocuments: vi.fn(), retrieveRagContext: vi.fn() }))

const chatSession = {} as AiChatSession

describe('createApiFeature', () => {
  let rootPath: string
  const appRuntimes: AppRuntime[] = []

  /** 一時ディレクトリを保存先にした実行環境を作る。 */
  async function createRuntime() {
    const dataPath = await fs.mkdtemp(path.join(rootPath, 'app-'))
    const appRuntime = new AppRuntime({
      paths: { appDataPath: dataPath, electronDataPath: dataPath } as MainPaths,
      devServerUrl: null,
      allowedDevOrigin: null,
      rendererRootUrl: null,
      logger: { dispose: vi.fn() } as unknown as Logger,
      secretStorage: {} as SecretStorage,
    })
    appRuntimes.push(appRuntime)
    return { appRuntime, dataPath }
  }

  /** 閉鎖イベントを発火できるwindowを作る。 */
  function createWindow() {
    const closedListeners: Array<() => void> = []
    const win = {
      webContents: {},
      once: (event: string, listener: () => void) => {
        if (event === 'closed') {
          closedListeners.push(listener)
        }
      },
    } as unknown as BrowserWindow
    return { win, close: () => closedListeners.forEach((listener) => listener()) }
  }

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'api-feature-'))
  })

  afterEach(async () => {
    await Promise.all(appRuntimes.splice(0).map((appRuntime) => appRuntime.dispose()))
    await fs.rm(rootPath, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('機能とwindow contextの作成だけでは保存領域も配信登録も作らない', async () => {
    // Arrange
    const { appRuntime, dataPath } = await createRuntime()

    // Act
    createApiFeature({ appRuntime }).createWindowContext(createWindow())
    const storedFiles = await fs.readdir(dataPath)

    // Assert
    expect(storedFiles).toEqual([])
    expect(appRuntime.appAssetRoots.get('storage-demo-objects')).toBeUndefined()
  })

  it('二つのwindowで認証・Todo・保存機能デモのruntimeを共有する', async () => {
    // Arrange
    const { appRuntime } = await createRuntime()
    const feature = createApiFeature({ appRuntime })
    const contextA = feature.createWindowContext(createWindow())
    const contextB = feature.createWindowContext(createWindow())

    // Act
    const [todoServiceA, todoServiceB, storageDemoServiceA, storageDemoServiceB] =
      await Promise.all([
        contextA.todo.getService(),
        contextB.todo.getService(),
        contextA.storageDemo.getService(),
        contextB.storageDemo.getService(),
      ])
    const authRuntimeA = contextA.auth.getRuntime()
    const authRuntimeB = contextB.auth.getRuntime()

    // Assert
    expect(todoServiceB).toBe(todoServiceA)
    expect(storageDemoServiceB).toBe(storageDemoServiceA)
    expect(authRuntimeB).toBe(authRuntimeA)
  })

  it('チャットのセッションをwindowごとに分ける', async () => {
    // Arrange
    const { appRuntime } = await createRuntime()
    const feature = createApiFeature({ appRuntime })
    const contextA = feature.createWindowContext(createWindow())
    const contextB = feature.createWindowContext(createWindow())

    // Act
    contextA.aiChat.setAiChatSession(chatSession)

    // Assert
    expect(contextA.aiChat.getAiChatSession()).toBe(chatSession)
    expect(contextB.aiChat.getAiChatSession()).toBeNull()
  })

  it('windowを閉じても他のwindowのruntime・セッションを破棄しない', async () => {
    // Arrange
    const { appRuntime } = await createRuntime()
    const feature = createApiFeature({ appRuntime })
    const closedWindow = createWindow()
    feature.createWindowContext(closedWindow)
    const remainingContext = feature.createWindowContext(createWindow())
    remainingContext.aiChat.setAiChatSession(chatSession)
    const authRuntime = remainingContext.auth.getRuntime()

    // Act
    closedWindow.close()
    const authStatus = authRuntime.getStatus()

    // Assert
    expect(authStatus).toBeDefined()
    expect(remainingContext.aiChat.getAiChatSession()).toBe(chatSession)
  })

  it('最後のwindowを閉じて再作成すると、アプリ状態は継続しwindow状態は新しくなる', async () => {
    // Arrange
    const { appRuntime } = await createRuntime()
    const feature = createApiFeature({ appRuntime })
    const firstWindow = createWindow()
    const firstContext = feature.createWindowContext(firstWindow)
    const authRuntime = firstContext.auth.getRuntime()
    const todoService = await firstContext.todo.getService()
    const storageDemoService = await firstContext.storageDemo.getService()
    firstContext.aiChat.setAiChatSession(chatSession)
    firstWindow.close()

    // Act
    const recreatedContext = feature.createWindowContext(createWindow())

    // Assert
    expect(recreatedContext.auth.getRuntime()).toBe(authRuntime)
    expect(await recreatedContext.todo.getService()).toBe(todoService)
    expect(recreatedContext.aiChat.getAiChatSession()).toBeNull()
    expect(await recreatedContext.storageDemo.getService()).toBe(storageDemoService)
  })

  it('別のアプリ構成とは状態を共有しない', async () => {
    // Arrange
    const first = await createRuntime()
    const second = await createRuntime()
    const contextA = createApiFeature(first).createWindowContext(createWindow())
    const contextB = createApiFeature(second).createWindowContext(createWindow())

    // Act
    const authRuntimeA = contextA.auth.getRuntime()
    const authRuntimeB = contextB.auth.getRuntime()

    // Assert
    expect(authRuntimeB).not.toBe(authRuntimeA)
  })

  it('アプリ終了時に作成済みのruntimeを解放する', async () => {
    // Arrange
    const { appRuntime } = await createRuntime()
    const context = createApiFeature({ appRuntime }).createWindowContext(createWindow())
    const authRuntime = context.auth.getRuntime()
    await context.todo.getService()

    // Act
    await appRuntime.dispose()

    // Act / Assert
    expect(() => authRuntime.getStatus()).toThrow('AuthRuntime is disposed')
    await expect(context.todo.getService()).rejects.toThrow('is disposed')
  })

  it('登録したAPI contextだけをWebContentsから解決し、解除後は拒否する', async () => {
    // Arrange
    const { appRuntime } = await createRuntime()
    const feature = createApiFeature({ appRuntime })
    const registry = new ApiContextRegistry()
    const webContentsA = {} as WebContents
    const webContentsB = {} as WebContents
    const contextA = feature.createWindowContext(createWindow())
    const contextB = feature.createWindowContext(createWindow())
    const unregisterA = registry.register(webContentsA, contextA)
    registry.register(webContentsB, contextB)

    // Act
    const resolvedA = registry.getOrThrow(webContentsA)
    const resolvedB = registry.getOrThrow(webContentsB)
    unregisterA()

    // Assert
    expect(resolvedA).toBe(contextA)
    expect(resolvedB).toBe(contextB)
    expect(() => registry.getOrThrow(webContentsA)).toThrow('Context is not found')
    expect(registry.getOrThrow(webContentsB)).toBe(contextB)
  })
})
