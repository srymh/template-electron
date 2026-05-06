import React from 'react'
import { type StyleName } from './config'
import {useDesignSystemSearchParams} from './design-system'

export function useStyle() {
  const [searchParams, setSearchParams] = useDesignSystemSearchParams()
  const { style } = searchParams

  const setStyle = React.useCallback((style: StyleName) => {
    setSearchParams({ style })
  }, [setSearchParams])

  return { style, setStyle }
}
