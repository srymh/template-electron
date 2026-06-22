import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const themeApiMocks = vi.hoisted(() => {
  return {
    setTheme: vi.fn(),
    updated: vi.fn(),
    unsubscribes: [] as Array<ReturnType<typeof vi.fn>>,
  }
})

vi.mock('@your-app-name/api/renderer', () => {
  return {
    theme: {
      setTheme: themeApiMocks.setTheme,
      on: {
        updated: themeApiMocks.updated,
      },
    },
  }
})

import { ThemeProvider, useTheme } from '@/components/theme-provider'

function ThemeProbe() {
  const { theme, setTheme } = useTheme()

  return (
    <>
      <span>{theme}</span>
      <button type="button" onClick={() => void setTheme('dark')}>
        set dark
      </button>
    </>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''

    themeApiMocks.setTheme.mockReset()
    themeApiMocks.setTheme.mockResolvedValue(undefined)

    themeApiMocks.updated.mockReset()
    themeApiMocks.unsubscribes.length = 0
    themeApiMocks.updated.mockImplementation(() => {
      const unsubscribe = vi.fn()
      themeApiMocks.unsubscribes.push(unsubscribe)
      return unsubscribe
    })

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
  })

  afterEach(() => {
    document.documentElement.className = ''
  })

  it('unsubscribes the current listener when leaving the system theme branch', async () => {
    render(
      <ThemeProvider defaultTheme="system" storageKey="theme-provider-test">
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(themeApiMocks.updated).toHaveBeenCalledTimes(1)
    expect(document.documentElement.classList.contains('light')).toBe(true)

    const firstUnsubscribe = themeApiMocks.unsubscribes[0]

    fireEvent.click(screen.getByRole('button', { name: 'set dark' }))

    await waitFor(() => {
      expect(firstUnsubscribe).toHaveBeenCalledTimes(1)
    })

    expect(themeApiMocks.updated).toHaveBeenCalledTimes(2)

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })
})
