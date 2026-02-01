import React, { Suspense, lazy, useMemo } from 'react'
import { SquareIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  [key: string]: string
} & React.ComponentProps<'svg'>

export function IconPlaceholder({ lucide, ...svgProps }: Props) {
  const Icon = useMemo(() => {
    if (!lucide) return null

    return lazy(async () => {
      const mod = (await import('lucide-react')) as Record<string, unknown>
      const picked = mod[lucide]

      // lucideのアイコンは forwardRef で object になり得るため、function 判定はしない
      if (!picked) {
        return { default: SquareIcon satisfies LucideIcon }
      }

      return { default: picked as LucideIcon }
    })
  }, [lucide])

  if (!lucide || !Icon) return null

  return (
    <Suspense fallback={<SquareIcon {...svgProps} />}>
      <Icon {...svgProps} />
    </Suspense>
  )
}
