import type { TextOptions } from '@tanstack/ai'

import {
  createWebSearchTool,
  createAddKnowledgeTool,
  createSearchKnowledgeTool,
} from '@repo/ai/ollama/tools'
import { clockToolDef } from '@repo/ai/tools/client/definitions'
import { switchThemeDarkTool, switchThemeLightTool } from '@repo/ai/tools/server'

/** チャットのツールが必要とする実行環境の能力。 */
export type AiChatToolCapabilities = {
  getOllamaApiKey: () => Promise<string | undefined>
  getRagDbPath: () => string
}

/**
 * モデルへ渡すツール一覧を組み立てる。ツールの追加・除外はこの一覧で行う。
 * client ツールは定義だけを載せ、実行実装は apps/web の features/chat/tools に登録する。
 * @param capabilities - ツールが実行時に参照する能力。secret と保存先は実行時まで参照しない
 * @returns server ツールと client ツール定義の一覧
 */
export function createAiChatTools(capabilities: AiChatToolCapabilities): TextOptions['tools'] {
  const { getOllamaApiKey, getRagDbPath } = capabilities
  return [
    switchThemeDarkTool,
    switchThemeLightTool,
    clockToolDef,
    createWebSearchTool(getOllamaApiKey),
    createAddKnowledgeTool({ getDbPath: getRagDbPath }),
    createSearchKnowledgeTool({ getDbPath: getRagDbPath }),
  ]
}
