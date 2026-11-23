import * as React from 'react'

import { Link, useLocation } from '@tanstack/react-router'
import {
  BookOpen,
  DatabaseIcon,
  HomeIcon,
  ListChecksIcon,
  LogInIcon,
  TableIcon,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@repo/ui/components/sidebar'

import logo from '@/assets/logo.svg'
import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import { useAuth } from '@/features/auth/api/auth'
import { OpenChat } from '@/features/chat/components/open-chat'

import pkgJson from '../../package.json'

// This is sample data.
const data = {
  navMain: [
    {
      title: 'Home',
      url: '/',
      icon: HomeIcon,
    },
    {
      title: 'やること',
      url: '/todo',
      icon: ListChecksIcon,
    },
    {
      title: '保存機能デモ',
      url: '/storage-demo',
      icon: DatabaseIcon,
    },
    {
      title: 'テーブルの検証',
      url: '/demo/table',
      icon: TableIcon,
    },
    {
      title: 'Documentation',
      url: '#',
      icon: BookOpen,
      items: [
        {
          title: 'Electron',
          url: 'https://www.electronjs.org/ja/',
          externalLink: true,
        },
        {
          title: 'TanStack',
          url: 'https://tanstack.com/',
          externalLink: true,
        },
        {
          title: 'Shadcn UI',
          url: 'https://ui.shadcn.com/',
          externalLink: true,
        },
        {
          title: 'Lucide Icons',
          url: 'https://lucide.dev/',
          externalLink: true,
        },
      ],
    },
  ],
}

/** アプリのナビゲーションと現在のログイン状態に応じた操作を表示する。 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const {
    auth: { isAuthenticated, user, logout },
  } = useAuth()

  const location = useLocation()

  return (
    <Sidebar collapsible="icon" {...props}>
      <div className="mt-(--traffic-light-height) w-full border-b" />
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded p-0.5">
                <img src={logo} alt="Logo" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Your App Name</span>
                <span className="truncate text-xs">v{pkgJson.version}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-auto data-[orientation=horizontal]:w-[95%]" />

      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>

      <SidebarSeparator className="mx-auto data-[orientation=horizontal]:w-[95%]" />

      <SidebarFooter>
        {isAuthenticated ? (
          <>
            <OpenChat />
            <NavUser
              user={{
                name: user?.username || 'Unknown',
                email: `${user?.username || 'unknown@example.com'}`,
                avatar: '',
              }}
              logout={logout}
            />
          </>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80 flex w-full items-center px-3 py-2 text-sm font-medium"
                render={
                  <Link
                    to="/login"
                    search={{ redirect: location.href }}
                    disabled={location.pathname === '/login'}
                  />
                }
              >
                <LogInIcon className="mr-2 h-4 w-4" />
                Login
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
