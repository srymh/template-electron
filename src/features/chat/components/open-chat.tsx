import { BotIcon } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Chat } from '@/features/chat/components/chat'

export function OpenChat() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Dialog modal={false}>
          <DialogTrigger asChild>
            <SidebarMenuButton
              variant="outline"
              className="bg-primary text-primary-foreground font-medium hover:bg-primary/90"
            >
              <BotIcon />
              <span>AIチャット</span>
            </SidebarMenuButton>
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
                AIチャット
              </h2>
            </DialogHeader>
            <Chat />
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
