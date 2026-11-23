import type { ApiInterface, WithCallerKeyApi } from '@repo/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const SECRET_API_KEY = 'secret' as const
export type SecretApiKey = typeof SECRET_API_KEY

export type SecretContext = {
  setSecret: (key: string, value: string) => Promise<void>
}

// -----------------------------------------------------------------------------
// インターフェイス定義

export type SecretApi = ApiInterface<{
  setSecret: (options: { key: string; value: string }) => Promise<void>
}>

// -----------------------------------------------------------------------------
// 実装

/**
 * 呼び出し元キーを受け取って各操作を返すシークレット保存 API を構成する。
 * @param getContext - 呼び出し元キーに対応する context を取得する関数
 * @returns 各操作をキーに対応する context へ接続する API
 */
export function getSecretApi<TKey>(
  getContext: (key: TKey) => SecretContext,
): WithCallerKeyApi<SecretApi, TKey> {
  return {
    setSecret: (key) => async (options) => {
      const { setSecret } = getContext(key)
      await setSecret(options.key, options.value)
    },
  }
}
