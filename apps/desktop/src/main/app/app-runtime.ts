import type { WebContents } from 'electron'

import type { BrowserWindow } from 'electron/main'

import type { Logger } from '../infra/logger'
import type { MainPaths } from '../infra/paths'

/** 破棄処理のデフォルトタイムアウト時間（ミリ秒） */
const DEFAULT_DISPOSE_TIMEOUT_MS = 5_000

export class AppRuntime {
  /** before-quit で呼ばれる破棄処理（同期/非同期混在可） */
  private readonly disposeSet: Set<(() => void) | (() => Promise<void>)> = new Set()
  private isDisposing = false

  devServerUrl: string | null = null
  rendererRootUrl: string | null = null
  allowedDevOrigin: string | null = null
  paths: MainPaths
  registerIpcCache = new WeakMap<WebContents, Map<string, () => void>>()
  // TODO: BrowserWindow.getAllWindows() で代替できるか検討
  private windowsById = new Map<number, BrowserWindow>()
  logger: Logger

  constructor({
    paths,
    devServerUrl,
    allowedDevOrigin,
    rendererRootUrl,
    logger,
  }: {
    paths: MainPaths
    devServerUrl: string | null
    allowedDevOrigin: string | null
    rendererRootUrl: string | null
    logger: Logger
  }) {
    this.paths = paths
    this.devServerUrl = devServerUrl
    this.allowedDevOrigin = allowedDevOrigin
    this.rendererRootUrl = rendererRootUrl
    this.logger = logger
  }

  addDispose(dispose: () => void | Promise<void>) {
    this.disposeSet.add(dispose)
  }

  async dispose(): Promise<boolean> {
    if (this.isDisposing) {
      return false
    }
    this.isDisposing = true

    // 破棄処理の実行
    const disposers = Array.from(this.disposeSet)
    this.disposeSet.clear()

    // タイムアウト付きで破棄処理を実行
    await runDisposeWithTimeout(disposers, DEFAULT_DISPOSE_TIMEOUT_MS)

    this.logger.dispose()

    return true
  }

  registerWindow(window: BrowserWindow): () => void {
    const windowId = window.id

    this.windowsById.set(windowId, window)
    return () => this.unregisterWindowById(windowId)
  }

  getWindow(id: number): BrowserWindow | undefined {
    return this.windowsById.get(id)
  }

  private unregisterWindowById(windowId: number) {
    this.windowsById.delete(windowId)
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 破棄処理をタイムアウト付きで実行する
 * @param disposers 破棄処理の配列
 * @param timeoutMs タイムアウト時間（ミリ秒）
 */
async function runDisposeWithTimeout(
  disposers: Array<() => void | Promise<void>>,
  timeoutMs: number,
): Promise<void> {
  // 破棄処理を実行する Promise
  const disposePromise = (async () => {
    // どれか1つ失敗しても他の破棄処理を続行するために Promise.allSettled を使用
    const results = await Promise.allSettled(
      disposers.map(async (dispose) => {
        await dispose()
      }),
    )

    // 失敗した破棄処理があればログに出力
    const rejected = results.filter((r) => r.status === 'rejected')
    if (rejected.length > 0) {
      console.error('[app:before-quit] dispose failed:', rejected)
    }
  })()

  // タイムアウト用の Promise
  const timeoutPromise = sleep(timeoutMs).then(() => {
    throw new Error(`dispose timeout after ${timeoutMs}ms`)
  })

  // 破棄処理か、タイムアウトのいずれか早い方を待機
  await Promise.race([disposePromise, timeoutPromise])
}
