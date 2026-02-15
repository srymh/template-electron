import { Link, createFileRoute } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/demo/')({
  component: RouteComponent,
  loader: () => ({ crumb: 'ダッシュボード' }),
})

function RouteComponent() {
  const kpis = [
    {
      title: '今日のイベント',
      value: '12',
      hint: '直近24時間',
    },
    {
      title: '未処理タスク',
      value: '3',
      hint: '要確認',
    },
    {
      title: '今週の作業',
      value: '7h 40m',
      hint: '自己申告ベース',
    },
    {
      title: '同期ステータス',
      value: 'OK',
      hint: 'ローカル',
    },
  ] as const

  const activities = [
    {
      name: '家計簿デモを更新',
      type: 'Kakeibo',
      status: 'done' as const,
      at: '10:12',
      to: '/demo/kakeibo',
    },
    {
      name: 'チャットを開始',
      type: 'Chat',
      status: 'running' as const,
      at: '09:48',
      to: '/demo/chat',
    },
    {
      name: 'テーブルのストレステスト',
      type: 'Table',
      status: 'queued' as const,
      at: '09:05',
      to: '/demo/table',
    },
    {
      name: 'Web Events の動作確認',
      type: 'Web',
      status: 'done' as const,
      at: '昨日',
      to: '/demo/web',
    },
  ] as const

  const statusBadge = (status: (typeof activities)[number]['status']) => {
    switch (status) {
      case 'done':
        return <Badge variant="secondary">完了</Badge>
      case 'running':
        return <Badge>実行中</Badge>
      case 'queued':
        return <Badge variant="outline">待機</Badge>
    }
  }

  return (
    <div className="w-full h-full">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">ダッシュボード</h1>
            <p className="text-sm text-muted-foreground">
              状態のサマリと、よく使う機能へのショートカット
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/settings">設定</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.title}>
              <CardHeader>
                <CardTitle className="text-sm">{kpi.title}</CardTitle>
                <CardDescription>{kpi.hint}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {kpi.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>最近のアクティビティ</CardTitle>
              <CardDescription>直近の操作ログ（サンプル）</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead className="w-[120px]">種別</TableHead>
                    <TableHead className="w-[120px]">状態</TableHead>
                    <TableHead className="w-[100px]">更新</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((a) => (
                    <TableRow key={`${a.type}-${a.at}-${a.name}`}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.type}</TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.at}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={a.to}>開く</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>クイックアクション</CardTitle>
              <CardDescription>よく触るデモへの導線</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full justify-start"
                variant="outline"
                asChild
              >
                <Link to="/demo/chat">チャット</Link>
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                asChild
              >
                <Link to="/demo/kakeibo">家計簿</Link>
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                asChild
              >
                <Link to="/demo/table">テーブル</Link>
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                asChild
              >
                <Link to="/demo/web">Web Events</Link>
              </Button>
            </CardContent>

            <Separator />

            <CardFooter className="justify-between">
              <div className="text-xs text-muted-foreground">
                この画面はダッシュボードの雛形です
              </div>
              <Button variant="link" size="sm" asChild>
                <Link to="/ui">UI</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
