import { createContext, useContext, useState } from 'react'

type DevToolsProviderProps = {
  children: React.ReactNode
  defaultHidden?: boolean
  storageKey?: string
}

type DevToolsProviderState = {
  hidden: boolean
  hide: () => void
  show: () => void
}

const initialState: DevToolsProviderState = {
  hidden: false,
  hide: () => {},
  show: () => {},
}

const DevToolsProviderContext =
  createContext<DevToolsProviderState>(initialState)

export function DevToolsProvider({
  children,
  defaultHidden = false,
  storageKey = 'vite-ui-devtools',
  ...props
}: DevToolsProviderProps) {
  const [hidden, setHidden] = useState<boolean>(
    () => localStorage.getItem(storageKey) === 'true' || defaultHidden,
  )

  const value = {
    hidden,
    hide: () => {
      localStorage.setItem(storageKey, 'true')
      setHidden(true)
    },
    show: () => {
      localStorage.setItem(storageKey, 'false')
      setHidden(false)
    },
  }

  return (
    <DevToolsProviderContext.Provider {...props} value={value}>
      {children}
    </DevToolsProviderContext.Provider>
  )
}

export const useDevTools = () => {
  const context = useContext(DevToolsProviderContext) as
    | DevToolsProviderState
    | undefined

  if (context === undefined)
    throw new Error('useDevTools must be used within a DevToolsProvider')

  return context
}
