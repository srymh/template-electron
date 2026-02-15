import * as React from 'react'
import {
  BookOpen,
  Frame,
  HomeIcon,
  LogInIcon,
  Map,
  Pickaxe,
  PieChart,
  ToggleLeftIcon,
} from 'lucide-react'
import { Link, useLocation } from '@tanstack/react-router'

import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
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
} from '@/components/ui/sidebar'
import { useAuth } from '@/features/auth/api/auth'
import { OpenChat } from '@/features/chat/components/open-chat'
import { components } from '@/features/ui-demo/constants'
import { formatKebabAsTitle } from '@/lib/format-kebab-as-title'

import logo from '@/assets/logo.svg'

// This is sample data.
const data = {
  navMain: [
    {
      title: 'Home',
      url: '/',
      icon: HomeIcon,
    },
    {
      title: 'Demo',
      url: '/demo/',
      icon: Pickaxe,
      isActive: true,
      items: [
        {
          title: 'TanStack Query',
          url: '/demo/tanstack-query',
        },
        {
          title: 'TanStack Table',
          url: '/demo/table',
        },
        {
          title: 'File System',
          url: '/demo/fs',
        },
        {
          title: 'Web Events',
          url: '/demo/web',
        },
        {
          title: 'Kakeibo',
          url: '/demo/kakeibo',
        },
        {
          title: 'Chat',
          url: '/demo/chat',
        },
        {
          title: 'Chat(TanStack AI)',
          url: '/demo/chat-t',
        },
      ],
    },
    {
      title: 'UI',
      url: '/ui/',
      icon: ToggleLeftIcon,
      items: components.map((component) => ({
        title: formatKebabAsTitle(component),
        url: `/ui/${component}`,
      })),
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
  projects: [
    {
      name: 'Design Engineering',
      url: '#',
      icon: Frame,
    },
    {
      name: 'Sales & Marketing',
      url: '#',
      icon: PieChart,
    },
    {
      name: 'Travel',
      url: '#',
      icon: Map,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const {
    auth: { isAuthenticated, user, logout },
  } = useAuth()

  const location = useLocation()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="size-8 aspect-square flex items-center justify-center rounded p-0.5">
                  <img src={logo} alt="Logo" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Your App Name</span>
                  <span className="truncate text-xs">template-electron</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="data-[orientation=horizontal]:w-[95%] mx-auto" />

      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>

      <SidebarSeparator className="data-[orientation=horizontal]:w-[95%] mx-auto" />

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
              <SidebarMenuButton asChild>
                <Link
                  className="bg-sidebar-accent text-sidebar-accent-foreground flex w-full items-center  px-3 py-2 text-sm font-medium hover:bg-sidebar-accent/80"
                  to="/login"
                  search={{
                    redirect: location.href,
                  }}
                  disabled={location.pathname === '/login'}
                >
                  <LogInIcon className="mr-2 h-4 w-4" />
                  Login
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
