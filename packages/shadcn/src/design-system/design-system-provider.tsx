"use client"

import * as React from "react"

import {
  buildRegistryTheme,
  DEFAULT_CONFIG,
  POINTER_CURSOR_SELECTOR,
  STYLES,
  THEMES,
  type DesignSystemConfig,
  type StyleName,
  type ThemeName,
} from "./config"
import {
  DesignSystemContext,
  type DesignSystemContextValue,
  type DesignSystemSearchParamsSetter,
} from "./design-system"

const THEME_STYLE_ELEMENT_ID = "design-system-theme-vars"
const MANAGED_BODY_CLASS_PREFIXES = ["style-", "base-color-"] as const
const NO_RADIUS_STYLES = new Set<StyleName>(["lyra", "sera"])
const POINTER_CURSOR_CSS = `@layer base {
  ${POINTER_CURSOR_SELECTOR} {
    cursor: pointer;
  }
}
`

type RegistryThemeCssVars = NonNullable<
  ReturnType<typeof buildRegistryTheme>["cssVars"]
>

type DesignFrameMessageData = {
  style?: unknown
  theme?: unknown
}

type DesignFrameMessage = {
  type: "design"
  data?: DesignFrameMessageData
}

const STYLE_NAMES = new Set<string>(STYLES.map(({ name }) => name))
const THEME_NAMES = new Set<string>(THEMES.map(({ name }) => name))

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function isInIframe() {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

function isSameOrigin(eventOrigin: string): boolean {
  const currentOrigin = window.location.origin
  if (currentOrigin === "null") {
    return eventOrigin === "null" || eventOrigin.startsWith("file://")
  }
  return eventOrigin === currentOrigin
}

function getDesignFrameMessageData(value: unknown): DesignFrameMessageData | null {
  if (!isRecord(value)) return null

  const maybe = value as DesignFrameMessage
  if (maybe.type !== "design") return null
  if (maybe.data === undefined) return {}
  if (!isRecord(maybe.data)) return null

  return maybe.data
}

function toStyleName(value: unknown): StyleName | undefined {
  if (typeof value !== "string") return undefined
  return STYLE_NAMES.has(value) ? (value as StyleName) : undefined
}

function toThemeName(value: unknown): ThemeName | undefined {
  if (typeof value !== "string") return undefined
  return THEME_NAMES.has(value) ? (value as ThemeName) : undefined
}

function removeManagedBodyClasses(body: Element) {
  for (const className of Array.from(body.classList)) {
    if (
      MANAGED_BODY_CLASS_PREFIXES.some((prefix) => className.startsWith(prefix))
    ) {
      body.classList.remove(className)
    }
  }
}

function buildCssRule(selector: string, cssVars?: Record<string, string>) {
  const declarations = Object.entries(cssVars ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n")

  if (!declarations) {
    return `${selector} {}\n`
  }

  return `${selector} {\n${declarations}\n}\n`
}

function buildThemeCssText(cssVars: RegistryThemeCssVars, pointer: boolean) {
  return [
    buildCssRule(":root", {
      ...(cssVars.theme ?? {}),
      ...(cssVars.light ?? {}),
    }),
    buildCssRule(".dark", cssVars.dark),
    pointer ? POINTER_CURSOR_CSS : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function DesignSystemProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [searchParams, setSearchParamsState] =
    React.useState<DesignSystemConfig>(() => ({ ...DEFAULT_CONFIG }))
  const setSearchParams = React.useCallback<DesignSystemSearchParamsSetter>(
    (newConfig) => {
      setSearchParamsState((currentConfig) => ({
        ...currentConfig,
        ...newConfig,
      }))
    },
    []
  )
  const contextValue = React.useMemo<DesignSystemContextValue>(
    () => ({
      searchParams,
      setSearchParams,
    }),
    [searchParams, setSearchParams]
  )
  const [isReady, setIsReady] = React.useState(false)
  const {
    style,
    theme,
    font,
    fontHeading,
    baseColor,
    chartColor,
    menuAccent,
    menuColor,
    pointer,
    radius,
  } = searchParams
  const effectiveRadius = NO_RADIUS_STYLES.has(style) ? "none" : radius
  // const selectedFont = React.useMemo(
  //   () => FONTS.find((fontOption) => fontOption.value === font),
  //   [font]
  // )
  // const selectedHeadingFont = React.useMemo(() => {
  //   if (fontHeading === "inherit" || fontHeading === font) {
  //     return selectedFont
  //   }

  //   return FONTS.find((fontOption) => fontOption.value === fontHeading)
  // }, [font, fontHeading, selectedFont])
  const initialFontSansRef = React.useRef<string | null>(null)
  const initialFontHeadingRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    initialFontSansRef.current =
      document.documentElement.style.getPropertyValue("--font-sans")
    initialFontHeadingRef.current =
      document.documentElement.style.getPropertyValue("--font-heading")

    return () => {
      removeManagedBodyClasses(document.body)
      document.getElementById(THEME_STYLE_ELEMENT_ID)?.remove()

      if (initialFontSansRef.current) {
        document.documentElement.style.setProperty(
          "--font-sans",
          initialFontSansRef.current
        )
      } else {
        document.documentElement.style.removeProperty("--font-sans")
      }

      if (initialFontHeadingRef.current) {
        document.documentElement.style.setProperty(
          "--font-heading",
          initialFontHeadingRef.current
        )
      } else {
        document.documentElement.style.removeProperty("--font-heading")
      }
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined" || !isInIframe()) {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      if (!isSameOrigin(event.origin)) return

      const data = getDesignFrameMessageData(event.data)
      if (!data) return

      const nextConfig: Partial<DesignSystemConfig> = {}
      const nextStyle = toStyleName(data.style)
      const nextTheme = toThemeName(data.theme)

      if (nextStyle) {
        nextConfig.style = nextStyle
      }

      if (nextTheme) {
        nextConfig.theme = nextTheme
      }

      if (Object.keys(nextConfig).length > 0) {
        setSearchParams(nextConfig)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [setSearchParams])

  // Use useLayoutEffect for synchronous style updates to prevent flash.
  React.useLayoutEffect(() => {
    if (!style || !theme || !font || !baseColor) {
      return
    }

    const body = document.body

    // Iterate over a snapshot so removals do not affect traversal.
    removeManagedBodyClasses(body)
    body.classList.add(`style-${style}`, `base-color-${baseColor}`)

    // // Update font.
    // // Always set --font-sans for the preview so the selected font is visible.
    // // The font type (sans/serif/mono) is metadata for the CLI updater.
    // if (selectedFont) {
    //   document.documentElement.style.setProperty(
    //     "--font-sans",
    //     selectedFont.font.style.fontFamily
    //   )
    // }

    // if (selectedHeadingFont) {
    //   document.documentElement.style.setProperty(
    //     "--font-heading",
    //     selectedHeadingFont.font.style.fontFamily
    //   )
    // }

    setIsReady(true)
  }, [
    style,
    theme,
    font,
    fontHeading,
    baseColor,
    // selectedFont,
    // selectedHeadingFont,
  ])

  const registryTheme = React.useMemo(() => {
    if (!baseColor || !theme || !menuAccent || !effectiveRadius) {
      return null
    }

    const config: DesignSystemConfig = {
      ...DEFAULT_CONFIG,
      baseColor,
      theme,
      chartColor,
      menuAccent,
      radius: effectiveRadius,
    }

    return buildRegistryTheme(config)
  }, [baseColor, theme, chartColor, menuAccent, effectiveRadius])

  // Use useLayoutEffect for synchronous CSS var updates.
  React.useLayoutEffect(() => {
    if (!registryTheme || !registryTheme.cssVars) {
      return
    }

    let styleElement = document.getElementById(
      THEME_STYLE_ELEMENT_ID
    ) as HTMLStyleElement | null

    if (!styleElement) {
      styleElement = document.createElement("style")
      styleElement.id = THEME_STYLE_ELEMENT_ID
      document.head.appendChild(styleElement)
    }

    styleElement.textContent = buildThemeCssText(registryTheme.cssVars, pointer)
  }, [registryTheme, pointer])

  // Handle menu color inversion by adding/removing dark class to elements with cn-menu-target.
  // useLayoutEffect to apply classes synchronously before paint, avoiding flash.
  React.useLayoutEffect(() => {
    if (!menuColor) {
      return
    }

    const isInvertedMenu =
      menuColor === "inverted" || menuColor === "inverted-translucent"
    const isTranslucentMenu =
      menuColor === "default-translucent" ||
      menuColor === "inverted-translucent"
    let frameId = 0

    const updateMenuElements = () => {
      const allElements = document.querySelectorAll<HTMLElement>(
        ".cn-menu-target, [data-menu-translucent]"
      )

      if (allElements.length === 0) {
        return
      }

      // Disable transitions while toggling classes.
      allElements.forEach((element) => {
        element.style.transition = "none"
      })

      allElements.forEach((element) => {
        if (element.classList.contains("cn-menu-target")) {
          if (isInvertedMenu) {
            element.classList.add("dark")
          } else {
            element.classList.remove("dark")
          }
        }

        // When translucent is enabled, move from data-attr to class so styles apply.
        // When disabled, move back to a data-attr so the element stays queryable
        // for future toggles without losing its identity as a menu element.
        if (isTranslucentMenu) {
          element.classList.add("cn-menu-translucent")
          element.removeAttribute("data-menu-translucent")
        } else if (element.classList.contains("cn-menu-translucent")) {
          element.classList.remove("cn-menu-translucent")
          element.setAttribute("data-menu-translucent", "")
        }
      })

      // Force a reflow, then re-enable transitions.
      void document.body.offsetHeight
      allElements.forEach((element) => {
        element.style.transition = ""
      })
    }

    const scheduleMenuUpdate = () => {
      if (frameId) {
        return
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        updateMenuElements()
      })
    }

    // Update existing menu elements.
    updateMenuElements()

    // Watch for new menu elements being added to the DOM.
    const observer = new MutationObserver(() => {
      scheduleMenuUpdate()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [menuColor])

  return (
    <DesignSystemContext.Provider value={contextValue}>
      {isReady ? children : null}
    </DesignSystemContext.Provider>
  )
}
