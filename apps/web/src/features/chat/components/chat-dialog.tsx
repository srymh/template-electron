import { BotIcon, XIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

import { Chat } from './chat'
import { useChatDialog } from './chat-context'

export function ChatDialog() {
  const { open, setOpen } = useChatDialog()

  return (
    <Dialog modal={false} open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[calc(var(--header-height)+var(--spacing,0.25rem)*2)] left-auto right-4 max-h-[calc(100vh-5rem)] translate-x-0 translate-y-0 overflow-hidden flex flex-col sm:max-w-md border border-primary shadow-lg shadow-primary/30 hover:shadow-primary/50"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center justify-start text-lg font-semibold gap-1">
              <BotIcon />
              <span>AIチャット</span>
            </div>
            <div className="flex items-center justify-end gap-1">
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="hover:text-destructive">
                  <XIcon />
                </Button>
              </DialogClose>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">AI と会話します。</DialogDescription>
        </DialogHeader>
        <Chat />
      </DialogContent>
    </Dialog>
  )
}
