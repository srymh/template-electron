import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)')({
  component: RouteComponent,
  beforeLoad: ({ context, location: { href } }) => {
    if (!context.auth.isAuthenticated) {
      // 認証されていないユーザーが保護されたページにアクセスしようとした場合、
      // /login にリダイレクト
      throw redirect({ to: '/login', search: { redirect: href } })
    }
  },
})

function RouteComponent() {
  return <Outlet />
}
