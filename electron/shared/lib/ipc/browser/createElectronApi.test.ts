import { describe, expect, it, vi } from 'vitest'

type MainApi = {
  fs: {
    read: () => string
    common: () => string
  }
}

type RendererApi = {
  fs: {
    write: () => string
    common: () => string
  }
}

vi.mock('electron', () => {
  return {
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
    ipcMain: {
      handle: vi.fn(),
    },
  }
})

describe('createElectronApi', () => {
  it('deep-merges plain-object keys (e.g. fs) instead of overwriting', async () => {
    const { createElectronApi } = await import('./createElectronApi')

    const api = createElectronApi<MainApi, RendererApi>(
      ({ defineHelper }) =>
        defineHelper({
          fs: {
            read: () => 'main-read',
            common: () => 'main-common',
          },
        }),
      ({ defineHelper }) =>
        defineHelper({
          fs: {
            write: () => 'renderer-write',
            common: () => 'renderer-common',
          },
        }),
      { registeredEventMap: new Map() },
    )

    expect(api.fs.read()).toBe('main-read')
    expect(api.fs.write()).toBe('renderer-write')
    // 同名の葉（関数など）は後勝ち
    expect(api.fs.common()).toBe('renderer-common')

    expect(Object.isFrozen(api)).toBe(true)
  })
})
