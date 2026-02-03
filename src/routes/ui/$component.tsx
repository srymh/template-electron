import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { FullscreenWrapper } from '@/components/fullscreen-wrapper'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { StyleSwitcher } from '@/features/style/components/style-switcher'

const demoConfigSchema = z.object({
  fullscreen: z.boolean().default(false).optional(),
})

export const Route = createFileRoute('/ui/$component')({
  component: RouteComponent,
  loader: ({ params: { component } }) => ({ crumb: component }),
  validateSearch: (search) => demoConfigSchema.parse(search),
})

// glob はモジュールスコープで1回
const modules = import.meta.glob(
  '/src/features/ui-demo/components/*-example.tsx',
)

// ★ここで「全部の Lazy コンポーネント」を render の外で作る
const registry: Record<
  string,
  React.LazyExoticComponent<React.ComponentType<any>>
> = {}

for (const [path, importer] of Object.entries(modules)) {
  const m = path.match(/\/([^/]+)-example\.tsx$/)
  if (!m) continue

  const name = m[1]
  // React.lazy は importer() が { default: Component } を返す前提
  registry[name] = React.lazy(importer as any)
}

export function ComponentLoader({ name }: { name: string }) {
  const Component = registry[name]

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!Component) {
    return null
  }

  return (
    <React.Suspense fallback={null}>
      <Component />
    </React.Suspense>
  )
}

function RouteComponent() {
  const { component } = Route.useParams()
  const { fullscreen } = Route.useSearch()

  return (
    <FullscreenWrapper fullscreen={fullscreen}>
      <div className="flex gap-2">
        <ThemeSwitcher />
        <StyleSwitcher />
      </div>
      <ComponentLoader name={component} />
    </FullscreenWrapper>
  )
}
