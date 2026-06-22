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

export function getSecretApi<TKey>(
  getContext: (key: TKey) => SecretContext,
): WithCallerKeyApi<SecretApi, TKey> {
  return {
    setSecret: async (options, key) => {
      const { setSecret } = getContext(key)
      await setSecret(options.key, options.value)
    },
  }
}
