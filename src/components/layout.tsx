import React from 'react'
import { Breadcrumbs } from './breadcrumbs'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { OpenChat } from '@/features/chat/components/open-chat'

export function Layout(props: { children?: React.ReactNode }) {
  const { children } = props

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
      <OpenChat />
    </SidebarProvider>
  )
}

function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-y transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumbs />
      </div>
    </header>
  )
}
