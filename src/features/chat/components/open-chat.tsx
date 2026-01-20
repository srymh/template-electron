import { BotIcon, MessageCircleCodeIcon } from 'lucide-react'

import { Chat } from './chat'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from '@/components/ui/dialog'

export function OpenChat() {
  return (
    <Dialog modal={false}>
      <DialogTrigger asChild>
        <Button
          className="fixed top-2 right-4 z-50 shadow"
          variant="outline"
          size="icon-sm"
        >
          <MessageCircleCodeIcon />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="top-2 left-auto right-4 max-h-[calc(100vh-5rem)] translate-x-0 translate-y-0 overflow-hidden flex flex-col sm:max-w-md"
        // ダイアログ外クリックで閉じないようにする
        onInteractOutside={(e) => e.preventDefault()}
        // ダイアログ外クリックで閉じないようにする
        onPointerDownOutside={(e) => e.preventDefault()}
        // ESC キーで閉じないようにする
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <h2 className="flex items-center text-lg font-semibold">
            <BotIcon className="inline mb-1 mr-2" />
            Chat
          </h2>
        </DialogHeader>
        <Chat />
      </DialogContent>
    </Dialog>
  )
}
