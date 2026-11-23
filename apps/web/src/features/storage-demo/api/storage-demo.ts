import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { storageDemo } from '@your-app-name/api/renderer'
import type { StorageDemoTableName } from '@your-app-name/api/storage-demo'

/** 保存機能デモの取得結果を識別するキー。更新後は対象の範囲だけを無効にする。 */
export const storageDemoQueryKeys = {
  objects: ['storage-demo', 'objects'] as const,
  tables: ['storage-demo', 'tables'] as const,
  rows: (tableName: StorageDemoTableName) => ['storage-demo', 'rows', tableName] as const,
}

/** オブジェクトストアの全件を取得する。 */
export function useStorageDemoObjects() {
  return useQuery({
    queryKey: storageDemoQueryKeys.objects,
    queryFn: () => storageDemo.objects.list(),
  })
}

/** オブジェクトの保存・検証・削除。保存と削除の後は一覧を取り直す。 */
export function useStorageDemoObjectMutations() {
  const queryClient = useQueryClient()
  const invalidateObjects = () =>
    queryClient.invalidateQueries({ queryKey: storageDemoQueryKeys.objects })

  return {
    put: useMutation({
      mutationFn: (input: Parameters<typeof storageDemo.objects.put>[0]) =>
        storageDemo.objects.put(input),
      onSuccess: invalidateObjects,
    }),
    verify: useMutation({
      mutationFn: (key: string) => storageDemo.objects.verify({ key }),
    }),
    remove: useMutation({
      mutationFn: (key: string) => storageDemo.objects.remove({ key }),
      onSuccess: invalidateObjects,
    }),
  }
}

/** 編集できるテーブルの定義を取得する。 */
export function useStorageDemoTables() {
  return useQuery({
    queryKey: storageDemoQueryKeys.tables,
    queryFn: () => storageDemo.tables.list(),
  })
}

/**
 * 選んだテーブルの行を取得する。
 * テーブルを切り替えて取得している間は、前のテーブルの行を表示したままにする。
 */
export function useStorageDemoRows(tableName: StorageDemoTableName) {
  return useQuery({
    queryKey: storageDemoQueryKeys.rows(tableName),
    queryFn: () => storageDemo.tables.listRows({ tableName }),
    placeholderData: keepPreviousData,
  })
}

/**
 * 行の追加・更新・削除。成功後はすべてのテーブルの行と、テーブル定義を取り直す。
 * 分類を変えると、項目の表示ラベルと、定義に含まれる参照先の選択肢も変わるため、
 * 変更したテーブルの行だけに限らない。
 */
export function useStorageDemoRowMutations() {
  const queryClient = useQueryClient()
  const invalidateRows = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['storage-demo', 'rows'] }),
      queryClient.invalidateQueries({ queryKey: storageDemoQueryKeys.tables }),
    ])

  return {
    create: useMutation({
      mutationFn: (input: Parameters<typeof storageDemo.tables.createRow>[0]) =>
        storageDemo.tables.createRow(input),
      onSuccess: invalidateRows,
    }),
    update: useMutation({
      mutationFn: (input: Parameters<typeof storageDemo.tables.updateRow>[0]) =>
        storageDemo.tables.updateRow(input),
      onSuccess: invalidateRows,
    }),
    remove: useMutation({
      mutationFn: (input: Parameters<typeof storageDemo.tables.removeRow>[0]) =>
        storageDemo.tables.removeRow(input),
      onSuccess: invalidateRows,
    }),
  }
}
