import { z } from 'zod'

export const MODELS = [
  'gpt-oss:20b-cloud',
  'gpt-oss:120b-cloud',
  'qwen3-vl:235b-cloud',
] as const

export const modelSchema = z.enum(MODELS)

export type Model = z.infer<typeof modelSchema>
