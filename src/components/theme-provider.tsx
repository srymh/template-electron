import { createContext, useContext, useEffect, useState } from 'react'
import { theme as themeApi } from '@/api'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey) as Theme | null
    return storedTheme || defaultTheme
  })

  useEffect(() => {
    // 初期化フラグを設定
    let initializing = true

    // 初期テーマをメインプロセスに通知
    themeApi.setTheme({ theme }).finally(() => {
      initializing = false
    })

    const unsubscribe = themeApi.on.updated((newTheme) => {
      // 初期化中はメインプロセスからのテーマ更新を無視
      if (initializing) return
      setTheme(newTheme)
    })

    const root = window.document.documentElement

    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)

    return () => {
      unsubscribe()
    }
  }, [theme])

  const value = {
    theme,
    setTheme: async (currentTheme: Theme) => {
      // 本当は localStorage ではなく、メインプロセスで保持するべき
      localStorage.setItem(storageKey, currentTheme)
      await themeApi.setTheme({ theme: currentTheme })
      setTheme(currentTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext) as
    | ThemeProviderState
    | undefined

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
