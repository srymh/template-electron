import { ollamaText } from '@tanstack/ai-ollama'

import type { Model } from './models'

/** 対応モデルごとに標準のテキスト生成 adapter を作る。 */
export const adapters: Record<Model, () => ReturnType<typeof ollamaText>> = {
  'gpt-oss:20b': () => ollamaText('gpt-oss:20b'),
  'gpt-oss:20b-cloud': () => ollamaText('gpt-oss:20b-cloud'),
  'gpt-oss:120b-cloud': () => ollamaText('gpt-oss:120b-cloud'),
  'qwen3.5:9b': () => ollamaText('qwen3.5:9b'),
  'qwen3-vl:235b-cloud': () => ollamaText('qwen3-vl:235b-cloud'),
}
