import { useTheme } from '../api/use-theme'
import { THEMES } from './themes'
import { cn } from '@/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      className={cn(className, 'flex-wrap')}
      type="single"
      variant="outline"
      value={theme}
      onValueChange={(value) => {
        if (value === theme) return
        if (value == '') return
        setTheme(value)
      }}
    >
      {THEMES.map((t) => (
        <ToggleGroupItem key={t.name} value={t.name}>
          {t.title}
          <div
            className="size-4 rounded-full"
            style={{
              backgroundColor: t.cssVars['light']['primary'],
            }}
          ></div>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
