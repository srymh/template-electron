import type { WebContents } from 'electron'

import type { Context as ApiContext } from '@your-app-name/api/main'

/** 呼び出し元のWebContentsとAPI contextの対応を保持する。 */
export class ApiContextRegistry {
  private readonly contexts = new WeakMap<WebContents, ApiContext>()

  /**
   * WebContentsのAPI contextを登録する。
   * @param webContents - IPCの呼び出し元
   * @param context - 以後のIPCで使うcontext
   * @returns 登録を解除する関数
   */
  register(webContents: WebContents, context: ApiContext): () => void {
    this.contexts.set(webContents, context)
    return () => {
      this.contexts.delete(webContents)
    }
  }

  /**
   * WebContentsに対応するAPI contextを取得する。
   * @param webContents - IPCの呼び出し元
   * @returns 登録済みのcontext
   * @throws 未登録または解除済みの場合
   */
  getOrThrow(webContents: WebContents): ApiContext {
    const context = this.contexts.get(webContents)
    if (!context) {
      throw new Error('Context is not found')
    }
    return context
  }
}
