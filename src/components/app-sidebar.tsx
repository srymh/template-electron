import * as React from 'react'
import {
  AudioWaveform,
  BookOpen,
  Command,
  Frame,
  GalleryVerticalEnd,
  LogInIcon,
  Map,
  Pickaxe,
  PieChart,
  SquareTerminal,
  ToggleLeftIcon,
} from 'lucide-react'
import { Link, useLocation } from '@tanstack/react-router'

import { NavMain } from '@/components/nav-main'
import { NavProjects } from '@/components/nav-projects'
import { NavUser } from '@/components/nav-user'
import { TeamSwitcher } from '@/components/team-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useAuth } from '@/features/auth/api/auth'
import { components } from '@/features/ui-demo/constants'
import { formatKebabAsTitle } from '@/lib/format-kebab-as-title'

// This is sample data.
const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
    {
      name: 'Evil Corp.',
      logo: Command,
      plan: 'Free',
    },
  ],
  navMain: [
    {
      title: 'Home',
      url: '/',
      icon: SquareTerminal,
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
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        {isAuthenticated ? (
          <NavUser
            user={{
              name: user?.username || 'Unknown',
              email: `${user?.username || 'unknown@example.com'}`,
              avatar: '',
            }}
            logout={logout}
          />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  className="bg-sidebar-accent text-sidebar-accent-foreground flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent/80"
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
