import * as React from 'react'

import { Outlet, createFileRoute } from '@tanstack/react-router'

import { DesignSystemProvider } from '@repo/shadcn/design-system'
import shadcnStyles from '@repo/shadcn/styles.css?inline'

const SHADCN_DEMO_STYLE_ID = 'shadcn-demo-styles'

export const Route = createFileRoute('/(app)/ui')({
  component: RouteComponent,
  loader: () => ({ crumb: 'UI' }),
})

function RouteComponent() {
  useShadcnDemoStyles()

  return (
    <DesignSystemProvider>
      <Outlet />
    </DesignSystemProvider>
  )
}

function useShadcnDemoStyles() {
  React.useLayoutEffect(() => {
    const existingStyle = document.getElementById(SHADCN_DEMO_STYLE_ID)
    if (existingStyle) return

    const style = document.createElement('style')
    style.id = SHADCN_DEMO_STYLE_ID
    style.textContent = shadcnStyles
    document.head.appendChild(style)

    return () => {
      style.remove()
    }
  }, [])
}
