import { BotIcon } from 'lucide-react'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@repo/ui/components/sidebar'

import { useChatDialog } from './chat-context'

export function OpenChat() {
  const { setOpen } = useChatDialog()
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
          onClick={handleOpen}
        >
          <BotIcon />
          <span>AIチャット</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
