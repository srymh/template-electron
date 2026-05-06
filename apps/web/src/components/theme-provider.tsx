import { createContext, useContext, useEffect, useState } from 'react'

import { theme as themeApi } from '@your-app-name/api'

import { useParentWindowMessage } from '@/hooks/use-iframe-message'

type Theme = 'dark' | 'light' | 'system'

type DesignFrameMessageData = {
  mode?: unknown
}

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

const THEMES = ['dark', 'light', 'system'] as const

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

function toTheme(value: unknown): Theme | undefined {
  if (typeof value !== 'string') return undefined
  return THEMES.includes(value as Theme) ? (value as Theme) : undefined
}

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
    const root = window.document.documentElement

    // 初期テーマをメインプロセスに通知
    themeApi.setTheme({ theme }).finally(() => {
      initializing = false
    })

    const unsubscribe = themeApi.on.updated((newTheme) => {
      // 初期化中はメインプロセスからのテーマ更新を無視
      if (initializing) return
      setTheme(newTheme)
    })

    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'

      root.classList.add(systemTheme)
    }

    if (theme !== 'system') {
      root.classList.add(theme)
    }

    return () => {
      unsubscribe()
    }
  }, [theme])

  useParentWindowMessage<DesignFrameMessageData>({
    type: 'design',
    onMessage: (data) => {
      const nextTheme = toTheme(data?.mode)
      if (nextTheme) setTheme(nextTheme)
    },
  })

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
  const context = useContext(ThemeProviderContext) as ThemeProviderState | undefined

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
