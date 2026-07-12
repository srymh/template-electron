import path from 'node:path'

import { createMCPClient } from '@tanstack/ai-mcp'

import type { AiChatContext } from '@your-app-name/api/aiChat'

import type { CreateApiContext } from './types'

export const createAiChatContext: CreateApiContext<AiChatContext> = ({
  appRuntime,
  appContext,
  windowState,
}) => {
  return {
    getMcpClient: async () => {
      if (appContext.mcpServer == null) {
        return null
      }

      const mcp = await createMCPClient({
        transport: {
          type: 'http',
          url: `http://localhost:${appContext.mcpServer.port}/mcp`,
        },
      })

      return mcp
    },
    getAiChatSession: () => {
      return windowState.aiChatSession
    },
    setAiChatSession: (session) => {
      windowState.aiChatSession = session
    },
    getApiKey: async (provider) => {
      if (provider === 'ollama') {
        try {
          return await appRuntime.secretStorage.retrieveSecret('OLLAMA_API_KEY')
        } catch {
          appRuntime.logger.warn('OLLAMA_API_KEY is not set in secret storage')
          return undefined
        }
      }

      return undefined
    },
    getRagDbPath: () => {
      return path.join(appRuntime.paths.userDataPath, 'sample-rag.db')
    },
  }
}
