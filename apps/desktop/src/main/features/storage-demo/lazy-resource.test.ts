import { describe, expect, it, vi } from 'vitest'

import { createLazyResource } from './lazy-resource'

const disposedMessage = '破棄済みです。'

describe('createLazyResource', () => {
  it('同時取得では資源を一度だけ開き、同じ値を共有する', async () => {
    // Arrange
    const value = { name: 'resource' }
    const open = vi.fn(async () => ({ value, close: vi.fn() }))
    const resource = createLazyResource(open, disposedMessage)

    // Act
    const opensBeforeAccess = open.mock.calls.length
    const [first, second] = await Promise.all([resource.get(), resource.get()])

    // Assert
    expect(opensBeforeAccess).toBe(0)
    expect(first).toBe(value)
    expect(second).toBe(value)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('初期化に失敗した後の取得では資源を開き直す', async () => {
    // Arrange
    const failure = new Error('open failed')
    const open = vi
      .fn<() => Promise<{ value: string; close: () => void }>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ value: 'reopened', close: vi.fn() })
    const resource = createLazyResource(open, disposedMessage)

    // Act / Assert
    await expect(resource.get()).rejects.toBe(failure)

    // Act: 失敗したPromiseを保持していないことを、次回取得の結果で観測する。
    const reopened = await resource.get()

    // Assert
    expect(reopened).toBe('reopened')
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('未使用のまま破棄した場合は資源を開かず、以後の取得を拒否する', async () => {
    // Arrange
    const open = vi.fn(async () => ({ value: 'unused', close: vi.fn() }))
    const resource = createLazyResource(open, disposedMessage)

    // Act
    await resource.dispose()

    // Act / Assert
    await expect(resource.get()).rejects.toThrow(disposedMessage)
    expect(open).not.toHaveBeenCalled()
  })

  it('初期化済みの資源は破棄時に一度だけ閉じ、再度の破棄では閉じない', async () => {
    // Arrange
    const close = vi.fn()
    const resource = createLazyResource(async () => ({ value: 'opened', close }), disposedMessage)
    await resource.get()

    // Act
    await resource.dispose()
    await resource.dispose()

    // Assert
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('初期化中に破棄すると開始済みの取得を拒否し、開いた資源を一度だけ閉じる', async () => {
    // Arrange: 破棄より後に開き終わる資源を用意する。
    const close = vi.fn()
    let finishOpening: () => void = () => {}
    const resource = createLazyResource(
      () =>
        new Promise<{ value: string; close: () => void }>((resolve) => {
          finishOpening = () => resolve({ value: 'late', close })
        }),
      disposedMessage,
    )
    const pendingValues = Promise.allSettled([resource.get(), resource.get()])

    // Act
    const disposal = resource.dispose()
    finishOpening()
    await disposal
    const results = await pendingValues

    // Assert
    expect(results).toEqual([
      { status: 'rejected', reason: new Error(disposedMessage) },
      { status: 'rejected', reason: new Error(disposedMessage) },
    ])
    expect(close).toHaveBeenCalledTimes(1)
  })
})
