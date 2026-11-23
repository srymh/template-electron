/** 開いた値と、その値が所有する資源の解放処理。 */
export type OpenedResource<T> = {
  value: T
  /** 開いた資源を解放する。lazy resourceが一度だけ呼び出す。 */
  close: () => void
}

/** 初回取得時に資源を開き、破棄時に解放する窓口。 */
export type LazyResource<T> = {
  /**
   * 資源を取得し、未初期化なら開く。
   * @returns 同時取得でも共有する値。初期化失敗後の次回取得は開き直す
   * @throws 初期化失敗、破棄済み、または初期化中に破棄された場合にrejectする
   */
  get: () => Promise<T>
  /**
   * 以後の取得を拒否し、初期化中の資源も完了を待って解放する。
   * @returns 解放の完了で解決する。未使用なら資源を開かない。
   *   破棄開始後の再呼び出しは最初の解放を待たずに解決する
   */
  dispose: () => Promise<void>
}

/**
 * 遅延初期化・同時取得の共有・失敗後の再試行・破棄を一つの状態で管理する。
 * @param open - 資源を開く。失敗時は自身が開いた途中の資源を解放してrejectする
 * @param disposedMessage - 破棄後の取得で通知するErrorのメッセージ
 * @returns 取得と破棄の窓口。作成時には資源を開かない
 */
export function createLazyResource<T>(
  open: () => Promise<OpenedResource<T>>,
  disposedMessage: string,
): LazyResource<T> {
  let opening: Promise<OpenedResource<T>> | null = null
  let disposed = false

  const initialize = async (): Promise<OpenedResource<T>> => {
    const resource = await open()
    // 開いている間に破棄された場合は、所有者がいない資源を残さない。
    if (disposed) {
      resource.close()
      throw new Error(disposedMessage)
    }

    return resource
  }

  return {
    get: async () => {
      if (disposed) {
        throw new Error(disposedMessage)
      }

      // 失敗したPromiseだけを捨て、次回の取得で開き直す。
      opening ??= initialize().catch((error: unknown) => {
        opening = null
        throw error
      })
      return (await opening).value
    },
    dispose: async () => {
      if (disposed) {
        return
      }

      disposed = true
      const pending = opening
      opening = null
      // 初期化中の破棄はinitialize側が解放するため、成功済みの資源だけを閉じる。
      const resource = await pending?.catch(() => null)
      resource?.close()
    },
  }
}
