import React from 'react'
import { Breadcrumbs } from './breadcrumbs'
import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { OpenChat } from '@/features/chat/components/open-chat'
import { useAuth } from '@/features/auth/api/auth'

export function Layout(props: { children?: React.ReactNode }) {
  const { children } = props
  const { auth } = useAuth()

  return (
    <SidebarProvider>
      <AppSidebar variant="sidebar" />
      <SidebarInset
        className="h-screen overflow-hidden"
        style={
          {
            '--header-height': '2rem',
          } as React.CSSProperties
        }
      >
        <SiteHeader />
        <div className="w-full h-full overflow-auto">{children}</div>
      </SidebarInset>
      {auth.isAuthenticated && <OpenChat />}
    </SidebarProvider>
  )
}

function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-y transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Breadcrumbs />
      </div>
    </header>
  )
}
