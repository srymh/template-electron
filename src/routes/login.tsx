import * as React from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'

type LoginSearch = {
  redirect?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: LoginSearch) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : '/',
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirect })
    }
  },
  component: LoginRouteComponent,
})

function LoginRouteComponent() {
  const { auth } = Route.useRouteContext()
  const { redirect: redirectTo } = Route.useSearch()
  const navigate = useNavigate()

  const [username, setUsername] = React.useState('demo')
  const [password, setPassword] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  return (
    <div className="h-full min-h-[calc(100vh-var(--header-height,0px))] grid place-items-center p-6">
      <form
        className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6"
        onSubmit={async (e) => {
          e.preventDefault()
          setIsLoading(true)
          setError(null)

          try {
            await auth.login(username, password)
            await navigate({ to: redirectTo })
          } catch {
            setError('ログインに失敗しました')
          } finally {
            setIsLoading(false)
          }
        }}
      >
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Login</h1>
          <p className="text-sm text-muted-foreground">
            オフライン認証: 初回はユーザー作成、その後はパスワード検証（SQLite /
            Main管理）
          </p>
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="w-full rounded border bg-background px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded border bg-background px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
