import * as React from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

type LoginSearch = {
  redirect?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: LoginSearch) => ({
    redirect: normalizeRedirectHref(search.redirect),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ href: search.redirect })
    }
  },
  component: LoginRouteComponent,
})

function LoginRouteComponent() {
  const { auth } = Route.useRouteContext()
  const { redirect: redirectTo } = Route.useSearch()
  const router = useRouter()

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
            router.history.push(redirectTo)
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

function normalizeRedirectHref(targetHref: unknown): string {
  // まずは文字列であることを確認
  if (typeof targetHref !== 'string') return '/'

  // 空白だけの文字列はルートにリダイレクト
  const trimmed = targetHref.trim()
  if (!trimmed) return '/'

  // 危険なスキームをブロック: javascript: や data: は許可しない
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return '/'

  // HashHistory でも扱いやすいように許可
  if (trimmed.startsWith('/')) return trimmed
  if (trimmed.startsWith('#/')) return trimmed

  // 完全な href が来ても、同一オリジン/同一ファイルに限定して許可

  // URL パースして、同一オリジンかつ同一ファイルへのリダイレクトのみ許可
  try {
    const current = new URL(window.location.href)
    const target = new URL(trimmed, current)

    if (current.protocol === 'file:') {
      // file:// の場合は「同じ index.html への戻り」だけ許可
      if (target.protocol !== 'file:') return '/'
      // パスが同じでない場合はルートにリダイレクト
      if (target.pathname !== current.pathname) return '/'
      // 同じファイルへのリダイレクトは許可
      return target.href
    }

    // 通常の http(s) の場合は同一オリジンのみ許可
    if (target.origin !== current.origin) return '/'
    // 同一オリジンであれば、パスがどうであれ許可
    return target.href
  } catch {
    // URL パースに失敗した場合は安全のためルートにリダイレクト
    return '/'
  }
}
