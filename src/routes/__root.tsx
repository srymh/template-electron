import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools'

import { Layout } from '../components/layout'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import type { QueryClient } from '@tanstack/react-query'

import type { AuthState } from '@/features/auth/api/auth'
import { useDevTools } from '@/components/devtools-provider'

const isDev = import.meta.env.DEV

interface MyRouterContext {
  queryClient: QueryClient
  auth: AuthState
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: Component,
})

function Component() {
  const { hidden: devToolsHidden } = useDevTools()
  const isIframe = window.self !== window.top

  const hidden = !isDev || devToolsHidden || isIframe

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
