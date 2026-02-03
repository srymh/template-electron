/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { use } from "react"

const iconPromiseCaches = new Map<string, Map<string, Promise<any>>>()

function getCache(libraryName: string) {
  if (!iconPromiseCaches.has(libraryName)) {
    iconPromiseCaches.set(libraryName, new Map())
  }
  return iconPromiseCaches.get(libraryName)!
}


export function createIconLoader(libraryName: string) {
  if (libraryName !== 'lucide') {
    throw new Error(`Unsupported library: ${libraryName}`)
  }

  const cache = getCache(libraryName)

  return function IconLoader({
    name,
    strokeWidth = 2,
    ...props
  }: {
    name: string
  } & React.ComponentProps<"svg">) {
    if (!cache.has(name)) {
      const promise = import("./lucide-react").then((mod) => {
        const icon = mod[name as keyof typeof mod]
        return icon || null
      })
      cache.set(name, promise)
    }

    const iconData = use(cache.get(name)!)

    if (!iconData) {
      return null
    }

    const IconComponent = iconData
    return <IconComponent {...props} />
  }
}
