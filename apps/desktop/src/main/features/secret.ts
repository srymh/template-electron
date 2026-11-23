import type { SecretContext } from '@your-app-name/api/secret'

import type { DesktopFeatureFactory } from '../app/feature'

/**
 * secretの保存を既存の保存能力へ委譲する機能を作成する。
 * @param host - secretの保存能力
 * @returns windowごとに保存窓口を生成する機能
 */
export const createSecretFeature: DesktopFeatureFactory<SecretContext> = ({ appRuntime }) => ({
  createWindowContext: () => ({
    setSecret: async (key, value) => {
      await appRuntime.storeSecret(key, value)
    },
  }),
})
