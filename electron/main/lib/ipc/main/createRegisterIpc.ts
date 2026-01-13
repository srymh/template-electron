import { ipcMain } from 'electron'
import { createResponseChannel } from '../shared/createResponseChannel'

import type { WebContents } from 'electron'
import type {
  Api,
  IpcRegistrationMap,
  RecursiveMethodKeys,
  WithWebContents,
  ExtractMethod,
  ExtractAddListener,
} from '../shared/types'

type CreateRegistrationMap<
  TElectronMainApi extends Api,
  TContext = any,
> = (helpers: {
  getContext: (webContents: WebContents) => TContext
  defineHelper: <T extends IpcRegistrationMap<TElectronMainApi>>(map: T) => T
}) => IpcRegistrationMap<TElectronMainApi>

type RegisterIpc<TContext = any> = (options: {
  getContext: (webContents: WebContents) => TContext
  cache: WeakMap<WebContents, Map<string, () => void>>
}) => void

/**
 * カリー化された IPC ハンドラ登録関数を生成します。
 * @returns
 */
const createRegisterInvoke =
  <TElectronMainApi extends Api>() =>
  <TChannel extends RecursiveMethodKeys<TElectronMainApi>>(
    channel: TChannel,
    method: WithWebContents<ExtractMethod<TElectronMainApi, TChannel>>,
  ) => {
    console.log(
      `${new Date().toISOString()} INFO: IPC Invoke Handler registered. Channel: ${channel}`,
    )

    const listener = async (
      event: Electron.IpcMainInvokeEvent,
      ...args: any[]
    ) => {
      try {
        // イベント送信元の WebContents を取得
        const webContents = event.sender
        return await method(...args, webContents)
      } catch (err) {
        if (err instanceof Error) {
          throw new Error(err.message)
        } else {
          throw new Error('Unknown error occurred')
        }
      }
    }

    ipcMain.handle(channel, listener)
  }

const createRegisterEvent = <TElectronMainApi extends Api>(
  /**
   * cacheはネストされたMapです。
   * 第1階層のキーは WebContents で、
   * 第2階層のキーは チャンネル名 です。
   * 値は登録解除関数です。
   */
  cache: WeakMap<WebContents, Map<string, () => void>>,
) => {
  const cleanupAttached = new WeakSet<WebContents>()

  const cleanup = (webContents: WebContents) => {
    const map = cache.get(webContents)
    if (!map) return

    for (const removeListener of map.values()) {
      try {
        removeListener()
      } catch (error) {
        console.warn('Failed to remove IPC event listener:', error)
      }
    }

    map.clear()
    cache.delete(webContents)
  }

  const attachCleanupOnce = (webContents: WebContents) => {
    if (cleanupAttached.has(webContents)) return
    cleanupAttached.add(webContents)

    webContents.once('destroyed', () => cleanup(webContents))
    webContents.once('render-process-gone', () => cleanup(webContents))
  }

  return <TChannel extends RecursiveMethodKeys<TElectronMainApi>>(
    /** イベントリスナー登録用のIPCチャンネル名 */
    channel: TChannel,
    /**
     * イベント応答リスナーの登録関数
     *
     * @param webContents イベント送信元の WebContents
     * @param listener 登録するイベント応答リスナー
     * @return 登録解除関数
     *
     * @note
     * ```
     * addListener: (listener: (...args: any[]) => void) => () => void
     * ```
     * では、型推論が働かない。
     *
     * ```
     * addListener: ExtractMethod<TElectronMainApi, TChannel>
     * ```
     * とすると、`ExtractMethod<TElectronMainApi, TChannel>` が
     * `(listener: (...args: any[]) => void) => () => void` の制約を満たさない
     * 可能性がある。
     *
     * 改善案として
     * ```
     * addListener: ExtractMethod<TElectronMainApi, TChannel> extends (
     *   listener: (...args: infer TArgs) => void) => () => void
     *  ? (listener: (...args: TArgs) => void) => () => void
     *  : never
     * ```
     * のように条件分岐させる。
     *
     * 最終的に `ExtractAddListener<TElectronMainApi, TChannel>` 型エイリアスを
     * 定義して使用する形にした。
     * ```
     * type ExtractAddListener<
     *   TElectronMainApi extends Api,
     *   TChannel extends RecursiveMethodKeys<TElectronMainApi>,
     * > =
     *   ExtractMethod<TElectronMainApi, TChannel> extends (
     *     listener: (...args: infer TArgs) => void,
     *   ) => () => void
     *     ? (listener: (...args: TArgs) => void) => () => void
     *     : never
     * addListener: ExtractAddListener<TElectronMainApi, TChannel>
     * ```
     */
    addListener: WithWebContents<
      ExtractAddListener<TElectronMainApi, TChannel>
    >,
  ) => {
    /**
     * イベントリスナー登録/解除ハンドラ
     * @param event IPCメインイベント
     * @param register 登録する場合は true、解除する場合は false
     * @returns 登録/解除が成功した場合は true、すでに登録/解除されていた場合は false
     */
    const registrationListener = (
      event: Electron.IpcMainInvokeEvent,
      register: boolean,
    ) => {
      // イベント送信元の WebContents を取得
      const webContents = event.sender
      // 応答チャンネル名を生成
      const responseChannel = createResponseChannel(channel)

      // window クローズ/クラッシュなどで確実に解除されるようにしておく
      attachCleanupOnce(webContents)

      if (register) {
        // ---------------------------------------------------------------------
        // 登録

        // すでに登録されている場合は何もしない
        if (
          cache.has(webContents) &&
          cache.get(webContents)!.has(responseChannel)
        ) {
          return false
        }

        // イベント応答リスナーを作成
        const responseListener = (...args: any[]) => {
          if (webContents.isDestroyed()) {
            return
          }
          // WebContents.send を使ってデータを送信する
          webContents.send(responseChannel, ...args)
        }
        // イベント応答リスナーを登録し、登録解除関数を取得
        const removeListener = addListener(responseListener, webContents)

        // キャッシュに登録解除関数を保存
        if (!cache.has(webContents)) {
          cache.set(webContents, new Map())
        }
        cache.get(webContents)!.set(responseChannel, removeListener)
        return true
      } else {
        // ---------------------------------------------------------------------
        // 登録解除

        // 登録されていない場合は何もしない
        if (
          !cache.has(webContents) ||
          !cache.get(webContents)!.has(responseChannel)
        ) {
          return false
        }

        // キャッシュから登録解除関数を取得して実行
        const removeListener = cache.get(webContents)!.get(responseChannel)!
        removeListener()

        // キャッシュから削除
        const map = cache.get(webContents)!
        map.delete(responseChannel)

        // すべて解除済みなら Map ごと破棄して参照を切る
        if (map.size === 0) {
          cache.delete(webContents)
        }
        return true
      }
    }

    // IPC ハンドラを登録
    console.log(
      `${new Date().toISOString()} INFO: IPC Event Handler registered. Channel: ${channel}`,
    )
    ipcMain.handle(channel, registrationListener)
  }
}

export const createRegisterIpc =
  <TElectronMainApi extends Api, TContext = any>(
    createRegistrationMap: CreateRegistrationMap<TElectronMainApi, TContext>,
  ): RegisterIpc<TContext> =>
  ({ getContext, cache }) => {
    const map = createRegistrationMap({
      getContext,
      defineHelper: <T extends IpcRegistrationMap<TElectronMainApi>>(map: T) =>
        map,
    })

    for (const channel of Object.keys(map) as Array<keyof typeof map>) {
      const entry = map[channel]
      if (entry.type === 'invoke') {
        createRegisterInvoke<TElectronMainApi>()(channel, entry.method)
      } else if (entry.type === 'event') {
        createRegisterEvent<TElectronMainApi>(cache)(
          channel,
          entry.addEventListener,
        )
      }
    }
  }
