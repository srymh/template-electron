import React from 'react'
import type { DesignSystemConfig } from "./config"

export type DesignSystemSearchParams = DesignSystemConfig
export type DesignSystemSearchParamsSetter = (
  newConfig: Partial<DesignSystemSearchParams>
) => void

export type DesignSystemContextValue = {
  searchParams: DesignSystemSearchParams
  setSearchParams: DesignSystemSearchParamsSetter
}

export const DesignSystemContext =
  React.createContext<DesignSystemContextValue | null>(null)

export function useDesignSystem() {
  const context = React.useContext(DesignSystemContext)

  if (!context) {
    throw new Error("useDesignSystem must be used within a DesignSystemProvider")
  }

  return context
}

export function useDesignSystemSearchParams(): [
  DesignSystemSearchParams,
  DesignSystemSearchParamsSetter,
] {
  const { searchParams, setSearchParams } = useDesignSystem()

  return [searchParams, setSearchParams]
}
