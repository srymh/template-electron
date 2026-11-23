import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs'

import { ObjectStoreSection } from './object-store-section'
import { TableEditorSection } from './table-editor-section'

/**
 * 保存機能デモの画面。ファイルを保存するオブジェクトストアと、SQLite テーブルの編集を
 * タブで切り替えて表示する。どちらも desktop の `app-data/storage-demo/` に保存する。
 */
export function StorageDemo() {
  return (
    <Tabs defaultValue="objects" className="flex min-h-0 flex-1 flex-col gap-3">
      <TabsList>
        <TabsTrigger value="objects">オブジェクトストア</TabsTrigger>
        <TabsTrigger value="tables">テーブル編集</TabsTrigger>
      </TabsList>
      <TabsContent value="objects" className="min-h-0 overflow-auto">
        <ObjectStoreSection />
      </TabsContent>
      <TabsContent value="tables" className="min-h-0 overflow-auto">
        <TableEditorSection />
      </TabsContent>
    </Tabs>
  )
}
