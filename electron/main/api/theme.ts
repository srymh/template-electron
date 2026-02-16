import { nativeTheme, systemPreferences } from 'electron'

import type { Event, WebContents, TitleBarOverlayOptions } from 'electron'
import type {
  ApiInterface,
  AddListener,
  WithWebContents,
  WithWebContentsApi,
} from '#/shared/lib/ipc'

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

const getTheme: WithWebContents<ThemeApi['getTheme']> = async () => {
  return nativeTheme.themeSource
}

const createSetTheme = (
  getContext: (wc: WebContents) => ThemeContext,
): WithWebContents<ThemeApi['setTheme']> => {
  return async ({ theme }, wc) => {
    const { setTitleBarOverlay } = getContext(wc)
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

export function getThemeApi(
  getContext: (webContents: WebContents) => ThemeContext,
): WithWebContentsApi<ThemeApi> {
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
