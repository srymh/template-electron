import { StrictMode, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import {
  RouterProvider,
  createHashHistory,
  createRouter,
} from '@tanstack/react-router'

import * as TanStackQueryProvider from './integrations/tanstack-query/root-provider.tsx'
import { routeTree } from './routeTree.gen'
import reportWebVitals from './reportWebVitals.ts'
import { ThemeProvider } from '@/components/theme-provider'
import { DevToolsProvider } from '@/components/devtools-provider.tsx'
import { AuthProvider, useAuth } from '@/features/auth/api/auth'
import { StyleProvider } from '@/features/style/components/style-provider'
import { Toaster } from '@/components/ui/sonner'

// 生成されたルートツリーをインポート

import './styles.css'
import './custom.css'

// 新しいルーターインスタンスを作成

const TanStackQueryProviderContext = TanStackQueryProvider.getContext()
const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProviderContext,
    // auth は実行時に <RouterProvider context={{ auth }} /> によって提供される
    auth: undefined!,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  history: createHashHistory(),
})

// 型安全性のためにルーターインスタンスを登録
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// アプリをレンダリング
const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)

  function InnerApp() {
    const { auth } = useAuth()

    const prevIsAuthenticated = useRef<boolean | null>(null)

    useEffect(() => {
      const wasAuthenticated = prevIsAuthenticated.current
      prevIsAuthenticated.current = auth.isAuthenticated

      // 明示的なログアウト (true -> false) にのみ反応する
      if (wasAuthenticated === true && auth.isAuthenticated === false) {
        const { pathname, href } = router.state.location

        // ユーザーが保護されたエリアにいる場合、/login に強制的に移動する
        // (beforeLoad などのガードはナビゲーション時に実行される。ログアウトだけでは再実行されない)
        if (pathname.startsWith('/demo')) {
          router.navigate({
            to: '/login',
            search: {
              redirect: href,
            },
          })
        }
      }
    }, [auth.isAuthenticated])

    return (
      <RouterProvider
        router={router}
        context={{
          ...TanStackQueryProviderContext,
          auth,
        }}
      />
    )
  }

  root.render(
    <StrictMode>
      <ThemeProvider>
        <StyleProvider>
          <DevToolsProvider defaultHidden={false}>
            <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
              <AuthProvider>
                <InnerApp />
              </AuthProvider>
            </TanStackQueryProvider.Provider>
          </DevToolsProvider>
          <Toaster />
        </StyleProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}

// アプリでパフォーマンス測定を開始する場合は、結果をログに記録する関数を渡してください
// (例: reportWebVitals(console.log))
// または分析エンドポイントに送信してください。詳細: https://bit.ly/CRA-vitals
reportWebVitals()
