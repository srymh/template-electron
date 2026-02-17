import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { FullscreenWrapper } from '@/components/fullscreen-wrapper'

export const Route = createFileRoute('/(app)/ui/$component')({
  component: RouteComponent,
  loader: ({ params: { component } }) => ({ crumb: component }),
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

  return (
    <FullscreenWrapper fullscreen>
      <ComponentLoader name={component} />
    </FullscreenWrapper>
  )
}
