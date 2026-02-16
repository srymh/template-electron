import React from 'react'
import { Breadcrumbs } from './breadcrumbs'
import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

export function Layout(props: { children?: React.ReactNode }) {
  const { children } = props

  return (
    <SidebarProvider>
      <AppSidebar variant="sidebar" />
      <SidebarInset className="h-screen overflow-hidden">
        <SiteHeader />
        <div className="w-full h-full overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-y transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="w-full flex items-center gap-2 pl-4 pr-(--title-bar-overlay-width)">
        <SidebarTrigger className="-ml-1" />
        <Breadcrumbs />
        <div
          data-custom-title-bar
          className="h-[calc(var(--header-height)-1px)] -mt-px flex-1 min-w-0 flex items-center justify-center"
        ></div>
      </div>
    </header>
  )
}
