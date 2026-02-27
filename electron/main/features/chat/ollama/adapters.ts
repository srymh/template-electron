import { createOllamaChat } from '@tanstack/ai-ollama'
import type { Model } from './models'

export const adapters: Record<
  Model,
  () => ReturnType<typeof createOllamaChat>
> = {
  'gpt-oss:20b-cloud': () => createOllamaChat('gpt-oss:20b-cloud'),
  'gpt-oss:120b-cloud': () => createOllamaChat('gpt-oss:120b-cloud'),
  'qwen3-vl:235b-cloud': () => createOllamaChat('qwen3-vl:235b-cloud'),
}
