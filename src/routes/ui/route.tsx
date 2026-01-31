import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/ui')({
  component: RouteComponent,
  loader: () => ({ crumb: 'UI' }),
})

function RouteComponent() {
  return <Outlet />
}
