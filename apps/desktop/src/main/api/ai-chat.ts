import path from 'node:path'

import { mcpToTanStackAiTools } from '@repo/tanstack-ai-mcp'
import type { AiChatContext } from '@your-app-name/api/aiChat'

import type { CreateApiContext } from './types'

export const createAiChatContext: CreateApiContext<AiChatContext> = ({
  appRuntime,
  appContext,
  windowState,
}) => {
  return {
    getToolsByMcp: async () => {
      if (appContext.mcpServer == null) {
        return []
      } else if (appContext.toolsByMcp != null) {
        return appContext.toolsByMcp
      }

      const toolsByMcp = await mcpToTanStackAiTools({
        httpOptions: {
          url: `http://localhost:${appContext.mcpServer.port}/mcp`,
        },
      })

      appContext.toolsByMcp = toolsByMcp
      return toolsByMcp
    },
    getSearchProjectDetailDbPath: () => {
      return path.join(appRuntime.paths.dataPath, 'example.db')
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
  }
}
