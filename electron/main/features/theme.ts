import { nativeTheme, systemPreferences } from 'electron'

import type { Event } from 'electron'
import type {
  ApiInterface,
  AddListener,
  WithWebContents,
  WithWebContentsApi,
} from '../lib/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const THEME_API_KEY = 'theme' as const
export type ThemeApiKey = typeof THEME_API_KEY

export type Theme = typeof nativeTheme.themeSource

// -----------------------------------------------------------------------------
// インターフェイス定義

export type ThemeApi = ApiInterface<{
  getTheme: () => Promise<Theme>
  setTheme: (options: { theme: Theme }) => Promise<void>
  getAccentColor: () => Promise<string>
  on: {
    accentColorChanged: AddListener<string>
    updated: AddListener<Theme>
  }
}>

// -----------------------------------------------------------------------------
// 実装

const getTheme: WithWebContents<ThemeApi['getTheme']> = async () => {
  return nativeTheme.themeSource
}

const setTheme: WithWebContents<ThemeApi['setTheme']> = async ({ theme }) => {
  nativeTheme.themeSource = theme
}

const getAccentColor: WithWebContents<
  ThemeApi['getAccentColor']
> = async () => {
  return systemPreferences.getAccentColor()
}

const onAccentColorChanged: WithWebContents<
  ThemeApi['on']['accentColorChanged']
> = (listener) => {
  const listenerWrapper = (_: Event, newColor: string) => {
    return listener(newColor)
  }

  systemPreferences.on('accent-color-changed', listenerWrapper)

  let hooked = false
  return () => {
    if (hooked) return
    hooked = true
    systemPreferences.off('accent-color-changed', listenerWrapper)
  }
}

const onUpdated: WithWebContents<ThemeApi['on']['updated']> = (listener) => {
  const listenerWrapper = () => {
    console.log('nativeTheme updated:', {
      themeSource: nativeTheme.themeSource,
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
      shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors,
      shouldUseInvertedColorScheme: nativeTheme.shouldUseInvertedColorScheme,
      inForcedColors: nativeTheme.inForcedColorsMode,
    })

    return listener(nativeTheme.themeSource)
  }

  nativeTheme.on('updated', listenerWrapper)

  let hooked = false
  return () => {
    if (hooked) return
    hooked = true
    nativeTheme.off('updated', listenerWrapper)
  }
}

export function getThemeApi(): WithWebContentsApi<ThemeApi> {
  return {
    getTheme,
    setTheme,
    getAccentColor,
    on: {
      accentColorChanged: onAccentColorChanged,
      updated: onUpdated,
    },
  }
}
