import { useStyle } from '../api/useStyle'
import { STYLES } from './style-provider'
import type { Style } from './style-provider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
        setStyle(value as Style)
      }}
    >
      {STYLES.map((s) => (
        <ToggleGroupItem key={s} value={s}>
          {formatKebabAsTitle(s)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
