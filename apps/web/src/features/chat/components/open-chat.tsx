import { BotIcon, XIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@repo/ui/components/sidebar'

import { Chat } from './chat'

export function OpenChat() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Dialog modal={false}>
          <DialogTrigger asChild>
            <SidebarMenuButton
              variant="outline"
              className="bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <BotIcon />
              <span>AIチャット</span>
            </SidebarMenuButton>
          </DialogTrigger>

          <DialogContent
            showCloseButton={false}
            className="top-[calc(var(--header-height)+var(--spacing,0.25rem)*2)] left-auto right-4 max-h-[calc(100vh-5rem)] translate-x-0 translate-y-0 overflow-hidden flex flex-col sm:max-w-md border border-primary shadow-lg shadow-primary/30 hover:shadow-primary/50"
            // ダイアログ外クリックで閉じないようにする
            onInteractOutside={(e) => e.preventDefault()}
            // ダイアログ外クリックで閉じないようにする
            onPointerDownOutside={(e) => e.preventDefault()}
            // ESC キーで閉じないようにする
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center justify-start text-lg font-semibold gap-1">
                  <BotIcon />
                  <span>AIチャット</span>
                </div>
                <div className="flex items-center justify-end  gap-1">
                  <DialogClose asChild>
                    <Button variant="ghost" size="sm" className="hover:text-destructive">
                      <XIcon />
                    </Button>
                  </DialogClose>
                </div>
              </DialogTitle>
              <DialogDescription>{/* no-op */}</DialogDescription>
            </DialogHeader>
            <Chat />
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
