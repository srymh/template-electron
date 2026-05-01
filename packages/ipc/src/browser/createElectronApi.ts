import { ipcRenderer } from 'electron'

import { createResponseChannel } from '../shared/createResponseChannel'
import type { Api, RecursiveMethodKeys, ExtractMethod, Listener } from '../shared/types'
import type { CreateFn, CreateRendererOnlyFn } from './types'

const useChannelAsInvoke = <TElectronApi extends Api>(
  channel: RecursiveMethodKeys<TElectronApi>,
) => {
  const invoke = (...args: any[]) => ipcRenderer.invoke(channel, ...args)
  return invoke as ExtractMethod<TElectronApi, typeof channel>
}

const useChannelAsEvent =
  (map: Map<string, () => void>) =>
  <TElectronApi extends Api>(channel: RecursiveMethodKeys<TElectronApi>) => {
    const responseChannel = createResponseChannel(channel)
    const addListener = (listener: Listener<any>) => {
      if (map.has(channel)) {
        console.warn(`Listener for ${channel} is already registered.`)
        return map.get(channel)!
      }

      // イベント取りこぼしを防ぐため、先にリスナーを登録する
      const listenerWrapper = (_: Electron.IpcRendererEvent, ...args: any[]) => {
        // 規約として args[1] 以降は無視して、args[0] のみを渡す
        listener(args[0])
      }

      ipcRenderer.on(responseChannel, listenerWrapper)

      // 二重実行防止用フラグ
      let disposed = false

      // 登録解除関数
      const removeListener = () => {
        if (disposed) return
        disposed = true

        // マップから削除
        map.delete(channel)

        // main プロセスにメッセージを送信してリスナーを解除します
        ipcRenderer.off(responseChannel, listenerWrapper)

        ipcRenderer
          .invoke(channel, false)
          .then((success) => {
            if (!success) {
              console.warn(`Listener for ${channel} was already removed in main process.`)
            }
          })
          .catch((error) => console.error(`Failed to remove listener for ${channel}:`, error))
      }

      map.set(channel, removeListener)

      // main プロセスにメッセージを送信してリスナーを登録します
      ipcRenderer
        .invoke(channel, true)
        .then((success) => {
          if (!success) {
            console.warn(`Listener for ${channel} was already registered in main process.`)
          }
        })
        .catch((error) => {
          console.error(`Failed to register listener for ${channel}:`, error)
          // main 登録に失敗した場合はロールバックして後始末する
          removeListener()
        })

      return removeListener
    }

    return addListener as ExtractMethod<TElectronApi, typeof channel>
  }

/**
 * Electron API オブジェクトを生成します。
 *
 * 使用できるプロセス
 * - renderer process: OK
 * - main process: NG
 *
 * @param create Electron API 作成関数
 * @param options オプション
 * @returns 不変の Electron API オブジェクト
 */
export const createElectronApi = <TElectronApi extends Api>(
  createFn: CreateFn<TElectronApi>,
  options: {
    registeredEventMap: Map<string, () => void>
  },
): Readonly<TElectronApi> => {
  const { registeredEventMap } = options ?? {}

  const electronApi = createFn({
    defineHelper: <T extends TElectronApi>(api: T) => api,
    useChannelAsInvoke: useChannelAsInvoke<TElectronApi>,
    useChannelAsEvent: useChannelAsEvent(registeredEventMap)<TElectronApi>,
  })

  // 不変オブジェクトとして返す
  return Object.freeze(electronApi)
}

export const createRendererOnlyElectronApi = <TElectronApi extends Api>(
  createFn: CreateRendererOnlyFn<TElectronApi>,
): Readonly<TElectronApi> => {
  const electronApi = createFn({ defineHelper: <T extends TElectronApi>(api: T) => api })

  // 不変オブジェクトとして返す
  return Object.freeze(electronApi)
}
