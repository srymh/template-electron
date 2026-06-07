import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { DesignSystemProvider, useDesignSystemSearchParams } from '@repo/shadcn/design-system'

function DesignSystemProbe() {
  const [params, setParams] = useDesignSystemSearchParams()

  return (
    <>
      <span data-testid="style">{params.style}</span>
      <span data-testid="radius">{params.radius}</span>
      <button type="button" onClick={() => setParams({ style: 'lyra' })}>
        Lyra
      </button>
      <button type="button" onClick={() => setParams({ style: 'sera' })}>
        Sera
      </button>
      <button type="button" onClick={() => setParams({ style: 'vega' })}>
        Vega
      </button>
      <button type="button" onClick={() => setParams({ style: 'nova' })}>
        Nova
      </button>
    </>
  )
}

describe('DesignSystemProvider', () => {
  afterEach(() => {
    cleanup()
    document.body.className = ''
    document.getElementById('design-system-theme-vars')?.remove()
  })

  it.each(['lyra', 'sera'] as const)(
    'keeps the configured radius after switching from %s to a rounded style',
    async (sharpStyle) => {
      render(
        <DesignSystemProvider>
          <DesignSystemProbe />
        </DesignSystemProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: new RegExp(sharpStyle, 'i') }))

      await waitFor(() => {
        expect(screen.getByTestId('style').textContent).toBe(sharpStyle)
      })

      expect(screen.getByTestId('radius').textContent).toBe('default')
      expect(document.head.textContent).toContain('--radius: 0;')

      fireEvent.click(screen.getByRole('button', { name: 'Vega' }))

      await waitFor(() => {
        expect(screen.getByTestId('style').textContent).toBe('vega')
      })

      expect(screen.getByTestId('radius').textContent).toBe('default')
      expect(document.head.textContent).not.toContain('--radius: 0;')
    },
  )
})
