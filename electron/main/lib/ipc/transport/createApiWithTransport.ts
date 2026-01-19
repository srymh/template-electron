/**
 * Transport-aware API creation
 *
 * Creates type-safe API using any RpcTransport implementation
 */

import { deepMergeRecord } from '../browser/deepMerge'
import type { RpcTransport } from '../../../../../shared/transport'
import type {
  Api,
  RecursiveMethodKeys,
  ExtractMethod,
  Listener,
} from '../shared/types'

type UseChannel<TElectronApi extends Api> = {
  <TChannel extends RecursiveMethodKeys<TElectronApi>>(
    channel: TChannel,
  ): ExtractMethod<TElectronApi, TChannel>
}

type CreateElectronMainApi<TElectronMainApi extends Api> = (helpers: {
  defineHelper: (api: TElectronMainApi) => TElectronMainApi
  useChannelAsInvoke: UseChannel<TElectronMainApi>
  useChannelAsEvent: UseChannel<TElectronMainApi>
}) => TElectronMainApi

type CreateElectronRendererApi<TElectronRendererApi extends Api> = (helpers: {
  defineHelper: (api: TElectronRendererApi) => TElectronRendererApi
}) => TElectronRendererApi

/**
 * Create invoke handler using transport
 */
const createUseChannelAsInvoke = <TElectronMainApi extends Api>(
  transport: RpcTransport,
) => {
  return (channel: RecursiveMethodKeys<TElectronMainApi>) => {
    const invoke = (...args: any[]) => transport.invoke(channel, ...args)
    return invoke as ExtractMethod<TElectronMainApi, typeof channel>
  }
}

/**
 * Create event handler using transport
 */
const createUseChannelAsEvent = <TElectronMainApi extends Api>(
  transport: RpcTransport,
  map: Map<string, () => void>,
) => {
  return (channel: RecursiveMethodKeys<TElectronMainApi>) => {
    const addListener = (listener: Listener<any>) => {
      if (map.has(channel)) {
        console.warn(`Listener for ${channel} is already registered.`)
        return map.get(channel)!
      }

      // Subscribe using transport
      const removeListener = transport.subscribe(channel, listener)

      // Store in map for duplicate detection
      map.set(channel, removeListener)

      return removeListener
    }

    return addListener as ExtractMethod<TElectronMainApi, typeof channel>
  }
}

/**
 * Create Electron API using a custom transport
 *
 * This allows using different transports (IPC, WebSocket, HTTP, etc.)
 * while maintaining the same type-safe API interface.
 *
 * @param transport The RPC transport to use
 * @param createElectronMainApi Main API creation function
 * @param createElectronRendererApi Renderer API creation function
 * @param options Additional options
 * @returns Frozen API object
 */
export const createElectronApiWithTransport = <
  TElectronMainApi extends Api,
  TElectronRendererApi extends Api = {},
>(
  transport: RpcTransport,
  createElectronMainApi: CreateElectronMainApi<TElectronMainApi>,
  createElectronRendererApi: CreateElectronRendererApi<TElectronRendererApi>,
  options: {
    registeredEventMap: Map<string, () => void>
  },
) => {
  const { registeredEventMap } = options

  const electronMainApi = createElectronMainApi({
    defineHelper: <T extends TElectronMainApi>(api: T) => api,
    useChannelAsInvoke: createUseChannelAsInvoke<TElectronMainApi>(transport),
    useChannelAsEvent: createUseChannelAsEvent<TElectronMainApi>(
      transport,
      registeredEventMap,
    ),
  })

  const electronRendererApi = createElectronRendererApi({
    defineHelper: <T extends TElectronRendererApi>(api: T) => api,
  })

  // Merge both APIs and return as frozen object
  return Object.freeze(deepMergeRecord(electronMainApi, electronRendererApi))
}
