import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { MoonIcon, PawPrintIcon, SunIcon } from 'lucide-react'
import { z } from 'zod'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/components/theme-provider'

const demoConfigSchema = z.object({
  fullscreen: z.boolean().default(false).optional(),
})

export const Route = createFileRoute('/ui/button')({
  component: RouteComponent,
  loader: () => ({ crumb: 'Button' }),
  validateSearch: (search) => demoConfigSchema.parse(search),
})

function RouteComponent() {
  const { fullscreen } = Route.useSearch()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [count, setCount] = useState(0)
  const handleClick = () => setCount((c) => c + 1)

  return (
    <div
      ref={containerRef}
      className={cn('p-2 bg-accent space-y-2', {
        'fixed inset-0 z-50 h-screen w-screen overflow-auto': fullscreen,
        'h-full': !fullscreen,
      })}
    >
      <div className="flex justify-between items-center">
        <div className="h-max text-4xl font-bold mx-2">{count}</div>
        <ThemeSwitcher />
      </div>
      <Separator />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 p-2 bg-background rounded border">
          <Button variant="default" onClick={handleClick}>
            Default
          </Button>
          <Button variant="destructive" onClick={handleClick}>
            Destructive
          </Button>
          <Button variant="ghost" onClick={handleClick}>
            Ghost
          </Button>
          <Button variant="link" onClick={handleClick}>
            Link
          </Button>
          <Button variant="outline" onClick={handleClick}>
            Outline
          </Button>
          <Button variant="secondary" onClick={handleClick}>
            Secondary
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 p-2 bg-background rounded border">
          <Button variant="default" size="default" onClick={handleClick}>
            Size Default
          </Button>
          <Button variant="default" size="icon" onClick={handleClick}>
            <PawPrintIcon />
          </Button>
          <Button variant="default" size="xs" onClick={handleClick}>
            Size XS
          </Button>
          <Button variant="default" size="icon-xs" onClick={handleClick}>
            <PawPrintIcon />
          </Button>
          <Button variant="default" size="sm" onClick={handleClick}>
            Size SM
          </Button>
          <Button variant="default" size="icon-sm" onClick={handleClick}>
            <PawPrintIcon />
          </Button>
          <Button variant="default" size="lg" onClick={handleClick}>
            Size LG
          </Button>
          <Button variant="default" size="icon-lg" onClick={handleClick}>
            <PawPrintIcon />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 p-2 bg-background rounded border">
          <Button
            variant="default"
            size="default"
            className="hover:shadow-lg transition-shadow active:scale-95"
            onClick={handleClick}
          >
            With Effects
          </Button>
        </div>
      </div>
    </div>
  )
}

function ThemeSwitcher() {
  const { setTheme } = useTheme()

  return (
    <div className="flex gap-2 bg-background w-max p-2 rounded">
      <Button variant="outline" size="icon" onClick={() => setTheme('light')}>
        <SunIcon />
      </Button>
      <Button variant="outline" size="icon" onClick={() => setTheme('dark')}>
        <MoonIcon />
      </Button>
    </div>
  )
}
