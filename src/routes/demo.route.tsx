import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/demo')({
  component: RouteComponent,
  loader: () => ({ crumb: 'Demo' }),
})

function RouteComponent() {
  return <Outlet />
}
