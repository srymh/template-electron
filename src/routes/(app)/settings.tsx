import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

import { ThemeSwitcher as ModeSwitcher } from '@/components/theme-switcher'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { StyleSwitcher } from '@/features/style/components/style-switcher'
import { ThemeSwitcher } from '@/features/style/components/theme-switcher'

export const Route = createFileRoute('/(app)/settings')({
  loader: () => ({ crumb: 'Settings' }),
  component: RouteComponent,
})

function RouteComponent() {
  const { auth } = Route.useRouteContext()

  const [language, setLanguage] = useLocalStorageState<'ja' | 'en'>(
    'settings.language',
    'ja',
  )
  const [restoreOnLaunch, setRestoreOnLaunch] = useLocalStorageState(
    'settings.restoreOnLaunch',
    true,
  )
  const [notifications, setNotifications] = useLocalStorageState(
    'settings.notifications',
    true,
  )
  const [autoUpdate, setAutoUpdate] = useLocalStorageState(
    'settings.autoUpdate',
    true,
  )
  const [downloadDir, setDownloadDir] = useLocalStorageState(
    'settings.downloadDir',
    '',
  )

  return (
    <div className="w-full h-full">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">設定</h1>
          <p className="text-sm text-muted-foreground">
            テーマ、見た目、動作に関する基本設定
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>外観</CardTitle>
            <CardDescription>テーマとデザインの切り替え</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">モード</div>
              <ModeSwitcher className="justify-start" />
              <div className="text-xs text-muted-foreground">
                ライト / ダーク / システム
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="text-sm font-medium">スタイル</div>
              <StyleSwitcher className="justify-start flex-wrap" />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="text-sm font-medium">テーマ</div>
              <ThemeSwitcher className="justify-start" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>一般</CardTitle>
            <CardDescription>変更は自動的に保存されます</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">言語</div>
                <div className="text-sm text-muted-foreground">
                  表示言語（画面の文言は順次対応）
                </div>
              </div>
              <Select
                value={language}
                onValueChange={(v) => setLanguage(v as 'ja' | 'en')}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <SettingSwitchRow
              title="起動時に前回の状態を復元"
              description="最後に開いていた画面/状態を復元します"
              checked={restoreOnLaunch}
              onCheckedChange={setRestoreOnLaunch}
            />

            <Separator />

            <SettingSwitchRow
              title="通知"
              description="重要なイベントをトーストで通知します"
              checked={notifications}
              onCheckedChange={setNotifications}
            />

            <Separator />

            <SettingSwitchRow
              title="自動アップデート"
              description="利用可能な更新を自動的に確認します"
              checked={autoUpdate}
              onCheckedChange={setAutoUpdate}
            />

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="downloadDir">ダウンロード先</Label>
              <Input
                id="downloadDir"
                placeholder="例: C:\\Users\\...\\Downloads"
                value={downloadDir}
                onChange={(e) => setDownloadDir(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                ここはUIサンプル（実際のダウンロード処理に接続する想定）
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>アカウント</CardTitle>
            <CardDescription>ログイン状態とセッション</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {auth.isAuthenticated ? (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">ログイン中</div>
                  <div className="text-sm text-muted-foreground">
                    ユーザー: {auth.user?.username}
                  </div>
                </div>
                <Button variant="outline" onClick={() => auth.logout()}>
                  ログアウト
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">未ログイン</div>
                  <div className="text-sm text-muted-foreground">
                    ログインしてデモ機能を有効化します
                  </div>
                </div>
                <Button asChild>
                  <Link to="/login" search={{ redirect: '/settings' }}>
                    ログイン
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <div className="text-xs text-muted-foreground">
              認証はSQLite（Main側）で管理されます
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

function SettingSwitchRow(props: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const { title, description, checked, onCheckedChange } = props

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function useLocalStorageState<T>(key: string, defaultValue: T) {
  const storageKey = `template-electron.${key}`

  const [value, setValue] = React.useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw == null) return defaultValue
      return JSON.parse(raw) as T
    } catch {
      return defaultValue
    }
  })

  const setAndPersist = React.useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // ignore
      }
    },
    [storageKey],
  )

  return [value, setAndPersist] as const
}
