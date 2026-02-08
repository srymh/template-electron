import { useContext } from 'react'

import { StyleProviderContext } from '../components/style-provider'

export function useStyle() {
  const context = useContext(StyleProviderContext)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (context == null) {
    throw new Error('useStyle must be used within a StyleProvider')
  }

  return context
}
