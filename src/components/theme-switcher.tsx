import { LaptopIcon, MoonIcon, SunIcon } from 'lucide-react'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useTheme } from '@/components/theme-provider'

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      className={className}
      type="single"
      variant="outline"
      value={theme}
      onValueChange={(value) => {
        if (value === theme) return
        if (value == '') return
        setTheme(value as 'light' | 'dark' | 'system')
      }}
    >
      <ToggleGroupItem value="light">
        <SunIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark">
        <MoonIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="system">
        <LaptopIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
