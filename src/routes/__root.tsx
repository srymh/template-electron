import {
  Outlet,
  createRootRouteWithContext,
  redirect,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools'

import { Layout } from '../components/layout'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import type { QueryClient } from '@tanstack/react-query'

import type { AuthState } from '@/features/auth/api/auth'
import { useDevTools } from '@/components/devtools-provider'

interface MyRouterContext {
  queryClient: QueryClient
  auth: AuthState
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: Component,
  beforeLoad: ({ context, location: { pathname, href } }) => {
    if (pathname === '/') {
      // トップページは常にアクセス可能
    } else if (pathname === '/login') {
      // Login ページは常にアクセス可能
    } else if (!context.auth.isAuthenticated) {
      // 認証されていないユーザーが保護されたページにアクセスしようとした場合、
      // /login にリダイレクト
      throw redirect({ to: '/login', search: { redirect: href } })
    } else {
      // 認証されているユーザーはアクセス可能
    }
  },
})

function Component() {
  const { hidden } = useDevTools()

  return (
    <>
      <Layout>
        <Outlet />
      </Layout>
      {hidden ? null : (
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
            aiDevtoolsPlugin(),
          ]}
          eventBusConfig={{
            connectToServerBus: true, // おそらく意味がない
          }}
        />
      )}
    </>
  )
}
