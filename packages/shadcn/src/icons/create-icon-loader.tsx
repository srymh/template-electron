"use client"

import { use, type ComponentProps, type ComponentType } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import type { IconLibraryName } from "./libraries"

type IconComponent = ComponentType<ComponentProps<"svg">>
type LoadedIcon = IconSvgElement | IconComponent | null
type IconModule = Record<string, Exclude<LoadedIcon, null>>

const iconModuleLoaders = {
  lucide: () => import("./__lucide__"),
  tabler: () => import("./__tabler__"),
  hugeicons: () => import("./__hugeicons__"),
  phosphor: () => import("./__phosphor__"),
  remixicon: () => import("./__remixicon__"),
} satisfies Record<IconLibraryName, () => Promise<object>>

const iconPromiseCaches = new Map<
  IconLibraryName,
  Map<string, Promise<LoadedIcon>>
>()

function getCache(libraryName: IconLibraryName) {
  if (!iconPromiseCaches.has(libraryName)) {
    iconPromiseCaches.set(libraryName, new Map())
  }
  return iconPromiseCaches.get(libraryName)!
}

function isIconData(data: LoadedIcon): data is IconSvgElement {
  return Array.isArray(data)
}

export function createIconLoader(libraryName: IconLibraryName) {
  const cache = getCache(libraryName)
  const loadIconModule = iconModuleLoaders[libraryName]

  return function IconLoader({
    name,
    strokeWidth = 2,
    ...props
  }: {
    name: string
  } & ComponentProps<"svg">) {
    const hugeiconsStrokeWidth =
      typeof strokeWidth === "number"
        ? strokeWidth
        : Number.parseFloat(String(strokeWidth))

    if (!cache.has(name)) {
      const promise = loadIconModule().then((mod) => {
        const icon = (mod as IconModule)[name]
        return icon ?? null
      })
      cache.set(name, promise)
    }

    const iconData = use(cache.get(name)!)

    if (!iconData) {
      return null
    }

    if (isIconData(iconData)) {
      return (
        <HugeiconsIcon
          icon={iconData}
          strokeWidth={Number.isFinite(hugeiconsStrokeWidth) ? hugeiconsStrokeWidth : undefined}
          {...props}
        />
      )
    }

    const IconComponent = iconData
    return <IconComponent strokeWidth={strokeWidth} {...props} />
  }
}
