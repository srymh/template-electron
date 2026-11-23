import path from 'node:path'

import type { AiChatSession } from '@repo/ai/chat/session'
import type { AiChatContext } from '@your-app-name/api/ai-chat'

import type { DesktopFeatureFactory } from '../../app/feature'
import { ingestDocumentAsKnowledge } from './ingest-document'
import { getAiChatSystemPrompts } from './system-prompts'
import { createAiChatTools } from './tools'

/**
 * window ごとにセッションを持つチャット機能を生成する。
 * @param host - 保存先・secret・ログを提供するアプリ実行環境
 * @returns チャットのツール構成と window ごとの context を生成する機能
 */
export const createAiChatFeature: DesktopFeatureFactory<AiChatContext> = ({ appRuntime }) => {
  const getOllamaApiKey = async () => {
    try {
      return await appRuntime.secretStorage.retrieveSecret('OLLAMA_API_KEY')
    } catch {
      appRuntime.logger.warn('OLLAMA_API_KEY is not set in secret storage')
      return undefined
    }
  }
  const getRagDbPath = () => {
    return path.join(appRuntime.paths.electronDataPath, 'sample-rag.db')
  }

  return {
    createWindowContext: () => {
      let session: AiChatSession | null = null

      return {
        getAiChatSession: () => {
          return session
        },
        setAiChatSession: (nextSession) => {
          session = nextSession
        },
        createTools: () => createAiChatTools({ getOllamaApiKey, getRagDbPath }),
        getSystemPrompts: getAiChatSystemPrompts,
        ingestDocument: (text) => ingestDocumentAsKnowledge(text, getRagDbPath),
      }
    },
  }
}
