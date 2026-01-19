import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { RpcTransport } from '../../../../../shared/transport/types'

// Mock electron
vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}))

describe('createElectronApiWithTransport', () => {
  let mockTransport: RpcTransport
  let invokeMap: Map<string, (...args: any[]) => Promise<any>>
  let subscribeMap: Map<string, (data: any) => void>

  beforeEach(() => {
    invokeMap = new Map()
    subscribeMap = new Map()

    mockTransport = {
      invoke: vi.fn(async (channel: string, ...args: any[]) => {
        const handler = invokeMap.get(channel)
        if (handler) {
          return handler(...args)
        }
        throw new Error(`No handler for ${channel}`)
      }),
      subscribe: vi.fn((channel: string, listener: (data: any) => void) => {
        subscribeMap.set(channel, listener)
        return () => {
          subscribeMap.delete(channel)
        }
      }),
    }
  })

  it('creates API using custom transport', async () => {
    const { createElectronApiWithTransport } = await import(
      './createApiWithTransport'
    )

    type TestApi = {
      test: {
        getValue: () => Promise<string>
        on: {
          changed: (listener: (value: string) => void) => () => void
        }
      }
    }

    // Setup mock handler
    invokeMap.set('test.getValue', async () => 'test-value')

    const api = createElectronApiWithTransport<TestApi>(
      mockTransport,
      ({ defineHelper, useChannelAsInvoke, useChannelAsEvent }) =>
        defineHelper({
          test: {
            getValue: useChannelAsInvoke('test.getValue'),
            on: {
              changed: useChannelAsEvent('test.on.changed'),
            },
          },
        }),
      ({ defineHelper }) => defineHelper({}),
      { registeredEventMap: new Map() }
    )

    // Test invoke
    const value = await api.test.getValue()
    expect(value).toBe('test-value')
    expect(mockTransport.invoke).toHaveBeenCalledWith('test.getValue')

    // Test event subscription
    const mockListener = vi.fn()
    const unsubscribe = api.test.on.changed(mockListener)

    expect(mockTransport.subscribe).toHaveBeenCalledWith(
      'test.on.changed',
      mockListener
    )

    // Simulate event
    const listener = subscribeMap.get('test.on.changed')
    expect(listener).toBeDefined()
    listener!('new-value')
    expect(mockListener).toHaveBeenCalledWith('new-value')

    // Test unsubscribe
    unsubscribe()
    expect(subscribeMap.has('test.on.changed')).toBe(false)
  })

  it('prevents duplicate event listeners on same channel', async () => {
    const { createElectronApiWithTransport } = await import(
      './createApiWithTransport'
    )

    type TestApi = {
      test: {
        on: {
          event: (listener: (value: string) => void) => () => void
        }
      }
    }

    const api = createElectronApiWithTransport<TestApi>(
      mockTransport,
      ({ defineHelper, useChannelAsEvent }) =>
        defineHelper({
          test: {
            on: {
              event: useChannelAsEvent('test.on.event'),
            },
          },
        }),
      ({ defineHelper }) => defineHelper({}),
      { registeredEventMap: new Map() }
    )

    // First subscription
    const unsubscribe1 = api.test.on.event(vi.fn())
    expect(mockTransport.subscribe).toHaveBeenCalledTimes(1)

    // Second subscription to same channel should warn and return first unsubscribe
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unsubscribe2 = api.test.on.event(vi.fn())

    expect(consoleSpy).toHaveBeenCalledWith(
      'Listener for test.on.event is already registered.'
    )
    expect(unsubscribe1).toBe(unsubscribe2)
    expect(mockTransport.subscribe).toHaveBeenCalledTimes(1) // Still only once

    consoleSpy.mockRestore()
  })

  it('freezes the returned API object', async () => {
    const { createElectronApiWithTransport } = await import(
      './createApiWithTransport'
    )

    type TestApi = {
      test: {
        method: () => Promise<void>
      }
    }

    const api = createElectronApiWithTransport<TestApi>(
      mockTransport,
      ({ defineHelper, useChannelAsInvoke }) =>
        defineHelper({
          test: {
            method: useChannelAsInvoke('test.method'),
          },
        }),
      ({ defineHelper }) => defineHelper({}),
      { registeredEventMap: new Map() }
    )

    expect(Object.isFrozen(api)).toBe(true)
  })
})
