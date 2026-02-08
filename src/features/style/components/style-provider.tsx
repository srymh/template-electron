import { createContext, useState } from 'react'
import type { ReactNode } from 'react'

export const STYLES = ['lyra', 'maia', 'mira', 'nova', 'vega'] as const

export type Style = (typeof STYLES)[number]

type StyleProviderState = {
  style: Style
  setStyle: (style: Style) => void
}

export const StyleProviderContext = createContext<StyleProviderState>(
  {} as StyleProviderState,
)

export type StyleProviderProps = {
  children: ReactNode
  defaultStyle?: Style
  storageKey?: string
}

export function StyleProvider(props: StyleProviderProps) {
  const {
    children,
    defaultStyle = 'vega',
    storageKey = 'vite-ui-style',
  } = props

  const root = window.document.documentElement

  const [style, setStyle] = useState<Style>(() => {
    const storedStyle = localStorage.getItem(storageKey) as Style | null
    const initialStyle = storedStyle ?? defaultStyle
    applyStyle(root, initialStyle)
    return initialStyle
  })

  const value = {
    style,
    setStyle: (newStyle: Style) => {
      applyStyle(root, newStyle)
      localStorage.setItem(storageKey, newStyle)
      setStyle(newStyle)
    },
  }

  return (
    <StyleProviderContext.Provider value={value}>
      {children}
    </StyleProviderContext.Provider>
  )
}

/**
 * style を適用する関数
 */
function applyStyle(el: HTMLElement, style: Style) {
  STYLES.forEach((s) => {
    el.classList.remove(`style-${s}`)
  })
  el.classList.add(`style-${style}`)
}
