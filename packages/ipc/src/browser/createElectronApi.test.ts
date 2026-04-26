import { beforeEach, describe, expect, it, vi } from 'vitest'

type MyApi = {
  fs: {
    read: (path: string) => Promise<string>
  }
  theme: {
    on: {
      updated: (listener: (theme: string) => void) => () => void
    }
  }
}

const electronMocks = vi.hoisted(() => {
  return {
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }
})

vi.mock('electron', () => {
  return {
    ipcRenderer: {
      invoke: electronMocks.invoke,
      on: electronMocks.on,
      off: electronMocks.off,
    },
  }
})

const createApi = async () => {
  const { createElectronApi } = await import('./createElectronApi')

  return createElectronApi<MyApi>(
    ({ defineHelper, useChannelAsEvent, useChannelAsInvoke }) =>
      defineHelper({
        fs: {
          read: useChannelAsInvoke('fs.read'),
        },
        theme: {
          on: {
            updated: useChannelAsEvent('theme.on.updated'),
          },
        },
      }),
    { registeredEventMap: new Map() },
  )
}

describe('createElectronApi', () => {
  beforeEach(() => {
    electronMocks.invoke.mockReset()
    electronMocks.on.mockReset()
    electronMocks.off.mockReset()
    electronMocks.invoke.mockResolvedValue(true)
  })

  it('invoke チャンネルを ipcRenderer.invoke に委譲する', async () => {
    const api = await createApi()

    electronMocks.invoke.mockResolvedValueOnce('main-read')

    await expect(api.fs.read('/tmp/example.txt')).resolves.toBe('main-read')

    expect(Object.isFrozen(api)).toBe(true)
    expect(electronMocks.invoke).toHaveBeenCalledWith('fs.read', '/tmp/example.txt')
  })

  it('event チャンネルで listener を登録して解除できる', async () => {
    const api = await createApi()
    const listener = vi.fn()

    const removeListener = api.theme.on.updated(listener)

    expect(electronMocks.on).toHaveBeenCalledTimes(1)
    expect(electronMocks.invoke).toHaveBeenCalledWith('theme.on.updated', true)
    expect(electronMocks.on.mock.invocationCallOrder[0]).toBeLessThan(
      electronMocks.invoke.mock.invocationCallOrder[0],
    )

    const [responseChannel, listenerWrapper] = electronMocks.on.mock.calls[0]

    expect(responseChannel).toBe('theme.on.updated::response')

    listenerWrapper({} as never, 'dark', 'ignored')

    expect(listener).toHaveBeenCalledWith('dark')

    removeListener()

    expect(electronMocks.off).toHaveBeenCalledWith('theme.on.updated::response', listenerWrapper)
    expect(electronMocks.invoke).toHaveBeenLastCalledWith('theme.on.updated', false)

    removeListener()

    expect(electronMocks.off).toHaveBeenCalledTimes(1)
    expect(electronMocks.invoke).toHaveBeenCalledTimes(2)
  })

  it('同じ event チャンネルの二重登録を防ぐ', async () => {
    const api = await createApi()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const removeListener = api.theme.on.updated(vi.fn())
    const duplicatedRemoveListener = api.theme.on.updated(vi.fn())

    expect(duplicatedRemoveListener).toBe(removeListener)
    expect(electronMocks.on).toHaveBeenCalledTimes(1)
    expect(electronMocks.invoke).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('Listener for theme.on.updated is already registered.')
  })

  it('main 側の event 登録失敗時はロールバックする', async () => {
    const api = await createApi()
    const error = new Error('register failed')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    electronMocks.invoke.mockRejectedValueOnce(error)
    electronMocks.invoke.mockResolvedValueOnce(true)

    api.theme.on.updated(vi.fn())

    const [, listenerWrapper] = electronMocks.on.mock.calls[0]

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to register listener for theme.on.updated:',
        error,
      )
      expect(electronMocks.off).toHaveBeenCalledWith('theme.on.updated::response', listenerWrapper)
      expect(electronMocks.invoke).toHaveBeenNthCalledWith(1, 'theme.on.updated', true)
      expect(electronMocks.invoke).toHaveBeenNthCalledWith(2, 'theme.on.updated', false)
    })
  })
})
