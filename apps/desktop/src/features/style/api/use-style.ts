import { useContext } from 'react'

import { StyleProviderContext } from '../components/style-provider'

export function useStyle() {
  const context = useContext(StyleProviderContext)
  if (context == null) {
    throw new Error('useStyle must be used within a StyleProvider')
  }

  return context
}
