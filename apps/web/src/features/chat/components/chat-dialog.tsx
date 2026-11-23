import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { BotIcon, XIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from '@repo/ui/components/dialog'

import { Chat } from './chat'
import { useChatDialog, useChatModel } from './chat-context'

/** 背後の画面を操作できるチャットウィンドウを表示する。 */
export function ChatDialog({ username }: { username?: string }) {
  const { open, setOpen } = useChatDialog()
  const { selectedModel, setSelectedModel } = useChatModel()

  return (
    <Dialog
      modal={false}
      open={open}
      disablePointerDismissal
      onOpenChange={(nextOpen, eventDetails) => {
        if (eventDetails.reason === 'escape-key' || eventDetails.reason === 'focus-out') {
          eventDetails.cancel()
          return
        }
        setOpen(nextOpen)
      }}
    >
      <DialogPortal>
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="border-primary bg-popover text-popover-foreground ring-foreground/10 shadow-primary/30 hover:shadow-primary/50 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-[calc(var(--header-height)+var(--spacing,0.25rem)*2)] right-4 z-50 flex max-h-[calc(100vh-5rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-4 overflow-hidden rounded-xl border p-4 text-xs/relaxed shadow-lg ring-1 duration-100 outline-none sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center justify-start gap-1 text-lg font-semibold">
                <BotIcon />
                <span>AIチャット</span>
              </div>
              <div className="flex items-center justify-end gap-1">
                <DialogClose
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:text-destructive"
                      aria-label="閉じる"
                    />
                  }
                >
                  <XIcon />
                </DialogClose>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">AI と会話します。</DialogDescription>
          </DialogHeader>
          <Chat
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            username={username}
          />
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
