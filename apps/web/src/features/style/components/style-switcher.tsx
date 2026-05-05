import { STYLES, useStyle } from '@repo/shadcn/design-system'
import type { StyleName } from '@repo/shadcn/design-system'
import { ToggleGroup, ToggleGroupItem } from '@repo/shadcn/ui/toggle-group'

import { formatKebabAsTitle } from '@/lib/format-kebab-as-title'

export function StyleSwitcher({ className }: { className?: string }) {
  const { style, setStyle } = useStyle()

  return (
    <ToggleGroup
      className={className}
      type="single"
      variant="outline"
      value={style}
      onValueChange={(value) => {
        if (value === style) return
        if (value == '') return
        setStyle(value as StyleName)
      }}
    >
      {STYLES.map(({ name }) => (
        <ToggleGroupItem key={name} value={name}>
          {formatKebabAsTitle(name)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
