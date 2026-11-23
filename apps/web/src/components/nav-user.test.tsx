import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { SidebarProvider } from '@repo/ui/components/sidebar'

import { NavUser } from './nav-user'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))

afterEach(() => vi.unstubAllGlobals())

it('ユーザーメニューを開くと設定とログアウトが表示される', () => {
  // Arrange
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  render(
    <SidebarProvider>
      <NavUser
        user={{ name: 'テストユーザー', email: 'test@example.com', avatar: '' }}
        logout={vi.fn()}
      />
    </SidebarProvider>,
  )

  // Act
  fireEvent.click(screen.getByRole('button', { name: /テストユーザー/ }))
  const menu = within(screen.getByRole('menu'))

  // Assert
  expect(menu.getByRole('menuitem', { name: '設定' })).toBeTruthy()
  expect(menu.getByRole('menuitem', { name: 'ログアウト' })).toBeTruthy()
})
