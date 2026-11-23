import { createFileRoute } from '@tanstack/react-router'

import { StorageDemo } from '@/features/storage-demo'

export const Route = createFileRoute('/(app)/storage-demo')({
  component: RouteComponent,
  loader: () => ({ crumb: '保存機能デモ' }),
})

/** 保存機能デモの入口。オブジェクトストアと SQLite テーブル編集を試せる。 */
function RouteComponent() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <h1 className="shrink-0 text-sm font-semibold">保存機能デモ</h1>
      <StorageDemo />
    </div>
  )
}
