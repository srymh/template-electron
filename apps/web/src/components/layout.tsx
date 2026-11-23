import React from 'react'

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@repo/ui/components/sidebar'
import { cn } from '@repo/ui/lib/utils'

import { AppSidebar } from '@/components/app-sidebar'
import { useAuth } from '@/features/auth/api/auth'
import { ChatHost } from '@/features/chat/components/chat-host'

import { Breadcrumbs } from './breadcrumbs'

export function Layout(props: { children?: React.ReactNode }) {
  const { children } = props

  return (
    <SidebarProvider>
      <AuthenticatedChatBoundary>
        <div className="group-has-data-[collapsible=icon]/sidebar-wrapper:bg-sidebar pointer-events-none fixed top-0 left-0 z-99999 h-(--traffic-light-height) w-(--traffic-light-width) group-has-data-[collapsible=icon]/sidebar-wrapper:border-r"></div>
        <AppSidebar variant="sidebar" />
        <SidebarInset className="h-screen overflow-hidden">
          <SiteHeader />
          <div className="h-full w-full overflow-auto">{children}</div>
        </SidebarInset>
      </AuthenticatedChatBoundary>
    </SidebarProvider>
  )
}

function AuthenticatedChatBoundary({ children }: { children: React.ReactNode }) {
  const {
    auth: { isAuthenticated, user },
  } = useAuth()

  if (!isAuthenticated) {
    return <>{children}</>
  }

  return (
    <ChatHost username={isAuthenticated ? user?.username || 'あなた' : undefined}>
      {children}
    </ChatHost>
  )
}

function SiteHeader() {
  const { isMobile } = useSidebar()

  return (
    <header className="flex h-[calc(var(--header-height)+1px)] shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-[calc(var(--header-height)+1px)]">
      <div className="flex w-full items-center gap-2 pr-(--title-bar-overlay-width) pl-4">
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
          className="flex h-(--header-height) min-w-0 flex-1 items-center justify-center"
        ></div>
      </div>
    </header>
  )
}
