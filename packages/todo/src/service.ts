import type { z } from 'zod'

import { TodoCreateInputSchema, TodoItemSchema, TodoUpdateInputSchema } from './schema'
import type { TodoCreateInput, TodoItem, TodoUpdateInput } from './schema'
import type { TodoStorage } from './storage'

export type TodoService = {
  list: () => Promise<TodoItem[]>
  get: (id: string) => Promise<TodoItem | null>
  create: (input: TodoCreateInput) => Promise<TodoItem>
  update: (id: string, patch: TodoUpdateInput) => Promise<TodoItem>
  setCompleted: (id: string, completed: boolean) => Promise<TodoItem>
  remove: (id: string) => Promise<void>
}

export type CreateTodoServiceOptions = {
  storage: TodoStorage

  /** 現在時刻（ISO文字列）を返す関数。テスト用に注入可能。 */
  now?: () => string

  /** UUID を返す関数。テスト用に注入可能。 */
  randomUUID?: () => string
}

/**
 * 既定の randomUUID を返す。
 *
 * Node/Electron/ブラウザで `globalThis.crypto.randomUUID()` を優先し、
 * 存在しない場合は呼び出し側に DI を要求する。
 */
function getDefaultRandomUUID(): () => string {
  const maybeCrypto = globalThis as unknown as {
    crypto?: { randomUUID?: () => string }
  }
  const randomUUID = maybeCrypto.crypto?.randomUUID
  if (randomUUID) return () => randomUUID.call(maybeCrypto.crypto)

  return () => {
    throw new Error('crypto.randomUUID is not available; provide randomUUID option')
  }
}

/** ZodError をユーザー向け文字列に整形する。 */
function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join('\n')
}

/**
 * ToDo のユースケース（ドメイン操作）を提供するサービス。
 *
 * - ストレージは DI で差し替え可能
 * - 入力/出力は zod で検証する
 */
export function createTodoService(options: CreateTodoServiceOptions): TodoService {
  const now = options.now ?? (() => new Date().toISOString())
  const randomUUID = options.randomUUID ?? getDefaultRandomUUID()
  const storage = options.storage

  return {
    /** 全件取得 */
    async list(): Promise<TodoItem[]> {
      return storage.list()
    },

    /** 1件取得（存在しない場合は null） */
    async get(id: string): Promise<TodoItem | null> {
      return storage.get(id)
    },

    /** 新規作成 */
    async create(input: TodoCreateInput): Promise<TodoItem> {
      const parsed = TodoCreateInputSchema.safeParse(input)
      if (!parsed.success) {
        throw new Error(formatZodError(parsed.error))
      }

      const timestamp = now()
      const item: TodoItem = {
        id: randomUUID(),
        title: parsed.data.title,
        description: parsed.data.description,
        completed: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      const validated = TodoItemSchema.parse(item)
      await storage.upsert(validated)
      return validated
    },

    /** title/description を更新 */
    async update(id: string, patch: TodoUpdateInput): Promise<TodoItem> {
      const existing = await storage.get(id)
      if (!existing) {
        throw new Error('Todo not found')
      }

      const parsed = TodoUpdateInputSchema.safeParse(patch)
      if (!parsed.success) {
        throw new Error(formatZodError(parsed.error))
      }

      const next: TodoItem = {
        ...existing,
        ...parsed.data,
        updatedAt: now(),
      }

      const validated = TodoItemSchema.parse(next)
      await storage.upsert(validated)
      return validated
    },

    /** completed を更新 */
    async setCompleted(id: string, completed: boolean): Promise<TodoItem> {
      const existing = await storage.get(id)
      if (!existing) {
        throw new Error('Todo not found')
      }

      const next: TodoItem = {
        ...existing,
        completed,
        updatedAt: now(),
      }

      const validated = TodoItemSchema.parse(next)
      await storage.upsert(validated)
      return validated
    },

    /** 削除 */
    async remove(id: string): Promise<void> {
      await storage.delete(id)
    },
  }
}
