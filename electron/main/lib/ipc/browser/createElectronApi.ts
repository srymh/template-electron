import { ipcRenderer } from 'electron'
import { deepMergeRecord } from './deepMerge'
import { createResponseChannel } from '../shared/createResponseChannel'

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

const useChannelAsInvoke = <TElectronMainApi extends Api>(
  channel: RecursiveMethodKeys<TElectronMainApi>,
) => {
  const invoke = (...args: any[]) => ipcRenderer.invoke(channel, ...args)
  return invoke as ExtractMethod<TElectronMainApi, typeof channel>
}

const useChannelAsEvent =
  (map: Map<string, () => void>) =>
  <TElectronMainApi extends Api>(
    channel: RecursiveMethodKeys<TElectronMainApi>,
  ) => {
    const responseChannel = createResponseChannel(channel)
    const addListener = (listener: Listener<any>) => {
      if (map.has(channel)) {
        console.warn(`Listener for ${channel} is already registered.`)
        return map.get(channel)!
      }

      // イベント取りこぼしを防ぐため、先にリスナーを登録する
      const listenerWrapper = (
        _: Electron.IpcRendererEvent,
        ...args: any[]
      ) => {
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
              console.warn(
                `Listener for ${channel} was already removed in main process.`,
              )
            }
          })
          .catch((error) =>
            console.error(`Failed to remove listener for ${channel}:`, error),
          )
      }

      map.set(channel, removeListener)

      // main プロセスにメッセージを送信してリスナーを登録します
      ipcRenderer
        .invoke(channel, true)
        .then((success) => {
          if (!success) {
            console.warn(
              `Listener for ${channel} was already registered in main process.`,
            )
          }
        })
        .catch((error) => {
          console.error(`Failed to register listener for ${channel}:`, error)
          // main 登録に失敗した場合はロールバックして後始末する
          removeListener()
        })

      return removeListener
    }

    return addListener as ExtractMethod<TElectronMainApi, typeof channel>
  }

/**
 * Electron API オブジェクトを生成します。
 *
 * 使用できるプロセス
 * - renderer process: OK
 * - main process: NG
 *
 * @param createElectronMainApi Electron Main API 作成関数
 * @param options オプション
 * @returns 不変の Electron API オブジェクト
 */
export const createElectronApi = <
  TElectronMainApi extends Api,
  // Renderer API が不要な場合のためにデフォルトを追加
  // しかし、省略時に defineHelper がすべてのオブジェクトを受け入れるようになるため、型安全性が若干低下する
  TElectronRendererApi extends Api = {},
>(
  createElectronMainApi: CreateElectronMainApi<TElectronMainApi>,
  createElectronRendererApi: CreateElectronRendererApi<TElectronRendererApi>,
  options: {
    registeredEventMap: Map<string, () => void>
  },
) => {
  const { registeredEventMap } = options

  const electronMainApi = createElectronMainApi({
    defineHelper: <T extends TElectronMainApi>(api: T) => api,
    useChannelAsInvoke: useChannelAsInvoke<TElectronMainApi>,
    useChannelAsEvent: useChannelAsEvent(registeredEventMap)<TElectronMainApi>,
  })

  const electronRendererApi = createElectronRendererApi({
    // TElectronRendererApi の指定が省略されたとき
    // {} にフォールバックするが、このとき defineHelper はすべてのオブジェクトを
    // 受け入れるようになる。そのため、型安全性が若干低下する
    defineHelper: <T extends TElectronRendererApi>(api: T) => api,
  })

  // 両方の API をマージして不変オブジェクトとして返す
  // 同名キーが「プレーンオブジェクト」同士の場合のみ、再帰的にマージする
  // （例: main.fs と renderer.fs を統合）。関数/配列などは後勝ちで上書き。
  return Object.freeze(deepMergeRecord(electronMainApi, electronRendererApi))
}
