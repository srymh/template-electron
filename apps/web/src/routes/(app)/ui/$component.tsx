import * as React from 'react'

import { createFileRoute } from '@tanstack/react-router'

import { registry } from '@repo/shadcn/demo/registry'

import { FullscreenWrapper } from '@/components/fullscreen-wrapper'

export const Route = createFileRoute('/(app)/ui/$component')({
  component: RouteComponent,
  loader: ({ params: { component } }) => ({ crumb: component }),
})

export function ComponentLoader({ name }: { name: string }) {
  const Component = registry[name]

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
