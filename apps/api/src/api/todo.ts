import type { ApiInterface, WithCallerKeyApi } from '@repo/ipc'
import type { TodoCreateInput, TodoItem, TodoService, TodoUpdateInput } from '@repo/todo'

// -----------------------------------------------------------------------------
// 型定義

export const TODO_API_KEY = 'todo' as const
export type TodoApiKey = typeof TODO_API_KEY

export type TodoContext = {
  getService: () => Promise<TodoService>
}

// -----------------------------------------------------------------------------
// インターフェイス定義

export type TodoApi = ApiInterface<{
  list: () => Promise<TodoItem[]>
  get: (options: { id: string }) => Promise<TodoItem | null>
  create: (options: { input: TodoCreateInput }) => Promise<TodoItem>
  update: (options: { id: string; patch: TodoUpdateInput }) => Promise<TodoItem>
  setCompleted: (options: { id: string; completed: boolean }) => Promise<TodoItem>
  remove: (options: { id: string }) => Promise<void>
}>

// -----------------------------------------------------------------------------
// 実装

/**
 * 呼び出し元キーを受け取って各操作を返すTodo API を構成する。
 * @param getContext - 呼び出し元キーに対応する context を取得する関数
 * @returns 各操作をキーに対応する context へ接続する API
 */
export function getTodoApi<TKey>(
  getContext: (key: TKey) => TodoContext,
): WithCallerKeyApi<TodoApi, TKey> {
  const getService = (key: TKey) => getContext(key).getService()

  return {
    list: (key) => async () => (await getService(key)).list(),
    get: (key) => async (options) => (await getService(key)).get(options.id),
    create: (key) => async (options) => (await getService(key)).create(options.input),
    update: (key) => async (options) => (await getService(key)).update(options.id, options.patch),
    setCompleted: (key) => async (options) =>
      (await getService(key)).setCompleted(options.id, options.completed),
    remove: (key) => async (options) => (await getService(key)).remove(options.id),
  }
}
