import { cn } from '@/lib/utils'

export function FullscreenWrapper({
  children,
  fullscreen,
}: {
  children: React.ReactNode
  fullscreen?: boolean
}) {
  return (
    <div
      className={cn('p-0 bg-accent space-y-2 h-full overflow-auto', {
        'fixed inset-0 z-50 h-screen w-screen overflow-auto': fullscreen,
        'h-full': !fullscreen,
      })}
    >
      {children}
    </div>
  )
}
