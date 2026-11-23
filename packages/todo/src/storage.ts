import type { TodoItem } from './schema'

/**
 * 永続化を差し替えるためのストレージIF。
 *
 * - renderer/main どちらでも扱えるよう、Promise ベースに統一。
 * - 「ドメインロジック」は service 側に寄せ、storage は保存/取得に集中させる。
 */
export type TodoStorage = {
  /** すべての ToDo を返す（並び順は実装依存）。 */
  list: () => Promise<TodoItem[]>

  /** 指定 ID の ToDo を返す。存在しない場合は null。 */
  get: (id: string) => Promise<TodoItem | null>

  /**
   * アイテムを保存する（新規/更新どちらも）。
   * service 側でスキーマ検証済みのデータが渡される想定。
   */
  upsert: (item: TodoItem) => Promise<void>

  /** 指定 ID の ToDo を削除する。存在しない場合は何もしない。 */
  delete: (id: string) => Promise<void>
}

/**
 * メモリ内実装。
 *
 * - テストや簡易利用向け。
 * - 追加順を維持するために ID 配列を別で保持する。
 */
export function createTodoMemoryStorage(): TodoStorage {
  const itemsById = new Map<string, TodoItem>()
  const ids: string[] = []

  return {
    async list(): Promise<TodoItem[]> {
      return ids
        .map((id) => itemsById.get(id))
        .filter((item): item is TodoItem => item !== undefined)
    },

    async get(id: string): Promise<TodoItem | null> {
      return itemsById.get(id) ?? null
    },

    async upsert(item: TodoItem): Promise<void> {
      if (!itemsById.has(item.id)) {
        ids.push(item.id)
      }
      itemsById.set(item.id, item)
    },

    async delete(id: string): Promise<void> {
      if (!itemsById.has(id)) return
      itemsById.delete(id)
      const index = ids.indexOf(id)
      if (index >= 0) ids.splice(index, 1)
    },
  }
}
