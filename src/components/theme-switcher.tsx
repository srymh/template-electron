import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-provider'

export function ThemeSwitcher() {
  const { setTheme } = useTheme()

  return (
    <div className="flex gap-2 bg-background w-max p-2 rounded border border-border">
      <Button variant="outline" size="icon" onClick={() => setTheme('light')}>
        <SunIcon />
      </Button>
      <Button variant="outline" size="icon" onClick={() => setTheme('dark')}>
        <MoonIcon />
      </Button>
    </div>
  )
}
