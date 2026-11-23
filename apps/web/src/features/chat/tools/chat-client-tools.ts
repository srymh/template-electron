import { clientTools } from '@tanstack/ai-client'

import { addKnowledgeToolDef, webSearchToolDef } from '@repo/ai/ollama/tools/definitions'
import { clockTool } from '@repo/ai/tools/client'

import { getCurrentPageTool } from './get-current-page'

/**
 * renderer で実行する client ツールの登録一覧。
 * 時計は main と共有する定義、ページ情報は renderer から宣言する定義を使う。
 * renderer の宣言は要求に含まれ、main 側で mergeAgentTools により取り込まれる。
 */
export const chatClientTools = clientTools(clockTool, getCurrentPageTool)

/** client 実行と server ツール承認に使う、サーバーと共通の定義。 */
export const chatTools = [...chatClientTools, webSearchToolDef, addKnowledgeToolDef] as const
