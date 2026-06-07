import React from 'react'

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@repo/ui/components/sidebar'
import { cn } from '@repo/ui/lib/utils'

import { AppSidebar } from '@/components/app-sidebar'

import { Breadcrumbs } from './breadcrumbs'

export function Layout(props: { children?: React.ReactNode }) {
  const { children } = props

  return (
    <SidebarProvider>
      <div className="w-(--traffic-light-width) group-has-data-[collapsible=icon]/sidebar-wrapper:bg-sidebar h-(--traffic-light-height) group-has-data-[collapsible=icon]/sidebar-wrapper:border-r fixed top-0 left-0 z-99999 pointer-events-none"></div>
      <AppSidebar variant="sidebar" />
      <SidebarInset className="h-screen overflow-hidden">
        <SiteHeader />
        <div className="w-full h-full overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function SiteHeader() {
  const { isMobile } = useSidebar()

  return (
    <header className="flex h-[calc(var(--header-height)+1px)] shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-[calc(var(--header-height)+1px)]">
      <div className="w-full flex items-center gap-2 pl-4 pr-(--title-bar-overlay-width)">
        <SidebarTrigger
          className={cn({
            'group-has-data-[collapsible=icon]/sidebar-wrapper:ml-[max(0px,calc(var(--traffic-light-width)-48px))]':
              !isMobile,
            'ml-(--traffic-light-width)': isMobile,
          })}
        />
        <Breadcrumbs />
        <div
          data-custom-title-bar
          className="h-(--header-height) flex-1 min-w-0 flex items-center justify-center"
        ></div>
      </div>
    </header>
  )
}
