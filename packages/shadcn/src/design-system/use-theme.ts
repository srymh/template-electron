import React from 'react'
import { type ThemeName } from './config'
import {useDesignSystemSearchParams} from './design-system'

export function useTheme() {
  const [searchParams, setSearchParams] = useDesignSystemSearchParams()
  const { theme } = searchParams

  const setTheme = React.useCallback((theme: ThemeName) => {
    setSearchParams({ theme })
  }, [setSearchParams])

  return { theme, setTheme }
}
