import * as React from 'react'
import { THEMES } from './themes'

export type Theme = (typeof THEMES)[number]['name']

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeProviderContext = React.createContext<ThemeProviderState>(
  {} as ThemeProviderState,
)

export type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider(props: ThemeProviderProps) {
  const {
    children,
    defaultTheme = 'teal',
    storageKey = 'vite-ui-design-theme',
  } = props

  const [theme, setTheme] = React.useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey)
    const initialTheme = storedTheme ?? defaultTheme
    return initialTheme
  })

  const document = window.document

  React.useLayoutEffect(() => {
    applyTheme(document, theme)
  }, [document, theme])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      applyTheme(document, newTheme)
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

/**
 * theme を適用する関数
 */
export function applyTheme(document: Document, theme: Theme) {
  const themeObj = THEMES.find((t) => t.name === theme)
  if (!themeObj) {
    return
  }

  const {
    theme: themeVars,
    light: lightVars,
    dark: darkVars,
  } = themeObj.cssVars

  let cssText = ':root {\n'
  if (themeVars) {
    Object.entries(themeVars).forEach(([key, value]) => {
      if (value) {
        cssText += `  --${key}: ${value};\n`
      }
    })
  }
  Object.entries(lightVars).forEach(([key, value]) => {
    if (value) {
      cssText += `  --${key}: ${value};\n`
    }
  })
  cssText += '}\n\n'

  cssText += '.dark {\n'
  Object.entries(darkVars).forEach(([key, value]) => {
    if (value) {
      cssText += `  --${key}: ${value};\n`
    }
  })
  cssText += '}\n'

  const styleId = 'ui-design-theme-vars'
  let styleElement = document.getElementById(styleId) as HTMLStyleElement | null
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = styleId
    document.head.appendChild(styleElement)
  }

  styleElement.textContent = cssText
}
