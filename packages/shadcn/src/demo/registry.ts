import * as React from 'react'

const modules = import.meta.glob('./components/*-example.tsx')

export const registry: Record<
  string,
  React.LazyExoticComponent<React.ComponentType>
> = {}

for (const [path, importer] of Object.entries(modules)) {
  const m = path.match(/\/([^/]+)-example\.tsx$/)
  if (!m) continue

  const name = m[1]
  registry[name] = React.lazy(importer as any)
}
