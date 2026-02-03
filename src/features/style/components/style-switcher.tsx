import { CheckIcon } from 'lucide-react'

import { useStyle } from '../api/useStyle'
import { STYLES } from './style-provider'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarBadge, AvatarFallback } from '@/components/ui/avatar'

export function StyleSwitcher() {
  const { style: current, setStyle } = useStyle()

  return (
    <div className="flex gap-2 bg-background w-max p-2 rounded border border-border">
      {STYLES.map((style) => (
        <Button
          key={style}
          asChild
          variant="ghost"
          size="icon-lg"
          onClick={() => setStyle(style)}
        >
          <Avatar size="lg">
            <AvatarFallback>
              {style.slice(0, 2).toUpperCase()}
              {current === style && (
                <AvatarBadge>
                  <CheckIcon />
                </AvatarBadge>
              )}
            </AvatarFallback>
          </Avatar>
        </Button>
      ))}
    </div>
  )
}
