import * as React from 'react'
import { StyleProvider } from './style-provider'
import { ThemeProvider } from './theme-provider'

export type ThemeProviderProps = {
  children: React.ReactNode
}

export function DesignProvider(props: ThemeProviderProps) {
  const { children } = props
  return (
    <StyleProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </StyleProvider>
  )
}
