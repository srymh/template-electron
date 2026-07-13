import * as React from 'react'

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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@repo/ui/components/sidebar'

import { Chat } from './chat'

type OpenChatContextValue = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const OpenChatContext = React.createContext<OpenChatContextValue | null>(null)

export function OpenChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  const value = React.useMemo<OpenChatContextValue>(
    () => ({
      open,
      setOpen,
    }),
    [open],
  )

  return <OpenChatContext.Provider value={value}>{children}</OpenChatContext.Provider>
}

export function OpenChat() {
  const { open, setOpen } = useOpenChat()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleOpen = () => {
    setOpen(true)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          variant="outline"
          className="bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-expanded={open}
          data-open={open ? true : undefined}
          onClick={handleOpen}
        >
          <BotIcon />
          <span>AIチャット</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function OpenChatDialog() {
  const { open, setOpen } = useOpenChat()

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

function useOpenChat() {
  const ctx = React.useContext(OpenChatContext)
  if (!ctx) {
    throw new Error('useOpenChat must be used within <OpenChatProvider />')
  }
  return ctx
}
