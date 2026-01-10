import * as React from 'react'
import {
  AudioWaveform,
  BookOpen,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  Pickaxe,
  PieChart,
  SquareTerminal,
} from 'lucide-react'

import { NavMain } from '@/components/nav-main'
import { NavProjects } from '@/components/nav-projects'
import { NavUser } from '@/components/nav-user'
import { TeamSwitcher } from '@/components/team-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'

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
      ],
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
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
