import { LaptopIcon, MoonIcon, SunIcon } from 'lucide-react'

import { ToggleGroup, ToggleGroupItem } from '@repo/ui/components/toggle-group'

import { useTheme } from '@/components/theme-provider'

/** ライト・ダーク・システムからテーマを一つ選択する。 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      className={className}
      variant="outline"
      value={[theme]}
      onValueChange={([value]) => {
        if (value === 'light' || value === 'dark' || value === 'system') {
          setTheme(value)
        }
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
