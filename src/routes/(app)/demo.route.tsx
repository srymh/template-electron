import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/demo')({
  component: RouteComponent,
  loader: () => ({ crumb: 'Demo' }),
})

function RouteComponent() {
  return <Outlet />
}
