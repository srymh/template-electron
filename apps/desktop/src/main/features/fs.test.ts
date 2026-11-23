import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { BrowserWindow } from 'electron'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppAssetRootRegistry } from '@repo/asset-protocol'

import type { AppRuntime } from '../app/app-runtime'
import { createFileSystemFeature } from './fs'

describe('createFileSystemFeature', () => {
  let root: string
  let filePath: string
  let outsideFilePath: string | null
  let appRuntime: Pick<AppRuntime, 'appAssetRoots' | 'addDispose'>
  let disposers: Array<() => void | Promise<void>>
  let feature: ReturnType<typeof createFileSystemFeature>
  let closedListener: (() => void) | undefined

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-app-asset-root-'))
    filePath = path.join(root, 'sample image.png')
    outsideFilePath = null
    await fs.writeFile(filePath, new Uint8Array([1, 2, 3]))

    disposers = []
    appRuntime = {
      appAssetRoots: createAppAssetRootRegistry([]),
      addDispose: (dispose) => {
        disposers.push(dispose)
      },
    }
    // 本番と同じく、一つの機能から各windowのcontextを作る。
    feature = createFileSystemFeature({ appRuntime: appRuntime as AppRuntime })
    closedListener = undefined
  })

  afterEach(async () => {
    if (outsideFilePath) {
      await fs.rm(outsideFilePath, { force: true })
    }
    await fs.rm(root, { recursive: true, force: true })
  })

  it('registers a directory and creates app-asset URLs inside that root', async () => {
    const context = createWindowContext()

    const registeredRoot = await context.registerAppAssetDirectory({ path: root })
    await expect(
      context.createAppAssetUrl({
        rootId: registeredRoot.rootId,
        path: filePath,
      }),
    ).resolves.toMatch(/^app-asset:\/\/user-dir-[0-9a-f-]+\/sample%20image\.png$/)
  })

  it('rejects file paths outside the registered root', async () => {
    const context = createWindowContext()

    const registeredRoot = await context.registerAppAssetDirectory({ path: root })
    outsideFilePath = path.join(path.dirname(root), `other-${path.basename(root)}.png`)
    await fs.writeFile(outsideFilePath, new Uint8Array([4, 5, 6]))

    await expect(
      context.createAppAssetUrl({
        rootId: registeredRoot.rootId,
        path: outsideFilePath,
      }),
    ).rejects.toThrow('Asset file path escapes root')
  })

  it('unregisters dynamic roots owned by the window', async () => {
    const context = createWindowContext()

    const registeredRoot = await context.registerAppAssetDirectory({ path: root })
    await expect(context.unregisterAppAssetRoot({ rootId: registeredRoot.rootId })).resolves.toBe(
      true,
    )
    await expect(context.unregisterAppAssetRoot({ rootId: registeredRoot.rootId })).resolves.toBe(
      false,
    )
  })

  it('unregisters dynamic roots when the window closes', async () => {
    const context = createWindowContext()

    const registeredRoot = await context.registerAppAssetDirectory({ path: root })
    closedListener?.()

    await expect(
      context.createAppAssetUrl({
        rootId: registeredRoot.rootId,
        path: filePath,
      }),
    ).rejects.toThrow('App asset root is not registered for this window')
  })

  it('registers a runtime disposer', () => {
    createWindowContext()

    expect(disposers).toHaveLength(1)
  })

  it('windowを閉じても他のwindowが登録したrootは解除しない', async () => {
    // Arrange
    const closedWindowContext = createWindowContext()
    const closeWindow = closedListener
    const remainingWindowContext = createWindowContext()
    const closedWindowRoot = await closedWindowContext.registerAppAssetDirectory({ path: root })
    const remainingWindowRoot = await remainingWindowContext.registerAppAssetDirectory({
      path: root,
    })

    // Act
    closeWindow?.()

    // Assert
    expect(appRuntime.appAssetRoots.get(closedWindowRoot.rootId)).toBeUndefined()
    expect(appRuntime.appAssetRoots.get(remainingWindowRoot.rootId)).toBeDefined()
  })

  it('アプリ終了時に全windowのrootを解除し、window閉鎖との重複でも失敗しない', async () => {
    // Arrange
    const closedWindowContext = createWindowContext()
    const closeWindow = closedListener
    const openWindowContext = createWindowContext()
    const closedWindowRoot = await closedWindowContext.registerAppAssetDirectory({ path: root })
    const openWindowRoot = await openWindowContext.registerAppAssetDirectory({ path: root })
    closeWindow?.()

    // Act
    await Promise.all(disposers.map((dispose) => dispose()))

    // Assert
    expect(appRuntime.appAssetRoots.get(closedWindowRoot.rootId)).toBeUndefined()
    expect(appRuntime.appAssetRoots.get(openWindowRoot.rootId)).toBeUndefined()
  })

  function createWindowContext() {
    return feature.createWindowContext({
      win: createWindowStub() as unknown as BrowserWindow,
    })
  }

  function createWindowStub() {
    return {
      once: vi.fn((event: string, listener: () => void) => {
        if (event === 'closed') {
          closedListener = listener
        }
      }),
    }
  }
})
