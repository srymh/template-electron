import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import Example from '@/features/ui-demo/components/accordion-example'
import { FullscreenWrapper } from '@/components/fullscreen-wrapper'
import { ThemeSwitcher } from '@/components/theme-switcher'

const demoConfigSchema = z.object({
  fullscreen: z.boolean().default(false).optional(),
})

export const Route = createFileRoute('/ui/accordion')({
  component: RouteComponent,
  loader: () => ({ crumb: 'Accordion' }),
  validateSearch: (search) => demoConfigSchema.parse(search),
})

function RouteComponent() {
  const { fullscreen } = Route.useSearch()
  return (
    <FullscreenWrapper fullscreen={fullscreen}>
      <ThemeSwitcher />
      <Example />
    </FullscreenWrapper>
  )
}
