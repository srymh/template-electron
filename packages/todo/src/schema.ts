import { z } from 'zod'

/**
 * ToDo のタイトル。
 * - 1文字以上
 * - 63文字以内
 */
export const TodoTitleSchema = z
  .string()
  .min(1, 'タイトルは必須です')
  .max(63, 'タイトルは63文字以内でなければなりません。')

/**
 * ToDo アイテム本体。
 *
 * 日付は ISO 8601 の datetime 文字列（offset 付き）を扱う。
 * 例: 2026-03-03T00:00:01.000Z
 */
export const TodoItemSchema = z.object({
  id: z.string(),
  title: TodoTitleSchema,
  description: z.string().optional(),
  completed: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})

export type TodoItem = z.infer<typeof TodoItemSchema>

/** 新規作成入力 */
export const TodoCreateInputSchema = z.object({
  title: TodoTitleSchema,
  description: z.string().optional(),
})

export type TodoCreateInput = z.infer<typeof TodoCreateInputSchema>

/** 更新入力（title/description のどちらかは必須） */
export const TodoUpdateInputSchema = z
  .object({
    title: TodoTitleSchema.optional(),
    description: z.string().optional(),
  })
  .refine((value) => value.title !== undefined || value.description !== undefined, {
    message: '更新内容が指定されていません。',
  })

export type TodoUpdateInput = z.infer<typeof TodoUpdateInputSchema>
