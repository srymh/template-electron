import { nativeTheme, systemPreferences } from 'electron'
import type { Event, TitleBarOverlayOptions } from 'electron'

import type { ApiInterface, AddListener, WithCallerKey, WithCallerKeyApi } from '@repo/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const THEME_API_KEY = 'theme' as const
export type ThemeApiKey = typeof THEME_API_KEY

export type Theme = typeof nativeTheme.themeSource

export type ThemeContext = {
  setTitleBarOverlay: (options: TitleBarOverlayOptions) => void
}

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

const getTheme: ThemeApi['getTheme'] = async () => {
  return nativeTheme.themeSource
}

const createSetTheme = <TKey>(
  getContext: (key: TKey) => ThemeContext,
): WithCallerKey<ThemeApi['setTheme'], TKey> => {
  return async ({ theme }, key) => {
    const { setTitleBarOverlay } = getContext(key)
    let symbolColor = theme === 'dark' ? '#FFFFFF' : '#000000'
    // もしテーマが system なら OS のダークモード設定に応じてシンボルカラーを決定する
    if (theme === 'system') {
      const shouldUseDarkColors = nativeTheme.shouldUseDarkColors
      symbolColor = shouldUseDarkColors ? '#FFFFFF' : '#000000'
    }
    setTitleBarOverlay({ symbolColor })
    nativeTheme.themeSource = theme
  }
}

const getAccentColor: ThemeApi['getAccentColor'] = async () => {
  return systemPreferences.getAccentColor()
}

const onAccentColorChanged: ThemeApi['on']['accentColorChanged'] = (listener) => {
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

const onUpdated: ThemeApi['on']['updated'] = (listener) => {
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

export function getThemeApi<TKey>(
  getContext: (key: TKey) => ThemeContext,
): WithCallerKeyApi<ThemeApi, TKey> {
  return {
    getTheme,
    setTheme: createSetTheme(getContext),
    getAccentColor,
    on: {
      accentColorChanged: onAccentColorChanged,
      updated: onUpdated,
    },
  }
}
