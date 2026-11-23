import { createFileRoute } from '@tanstack/react-router'

import { TableDemo } from '@/features/table-demo'

export const Route = createFileRoute('/demo/table')({
  component: RouteComponent,
  loader: () => ({ crumb: 'テーブルの検証' }),
})

/**
 * next のテーブルの検証画面の入口。認証を必要とせず、直接の URL（`/demo/table`）で開く。
 * レイアウトの本文領域の高さちょうどに収め、スクロールは表の内側で行う。
 */
function RouteComponent() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <h1 className="shrink-0 text-sm font-semibold">テーブルの検証</h1>
      <TableDemo />
    </div>
  )
}
