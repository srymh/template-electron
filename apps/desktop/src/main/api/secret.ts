import type { SecretContext } from '@your-app-name/api/secret'

import type { CreateApiContext } from './types'

export const createSecretContext: CreateApiContext<SecretContext> = ({ appRuntime }) => {
  return {
    setSecret: async (key, value) => {
      await appRuntime.storeSecret(key, value)
    },
  }
}
