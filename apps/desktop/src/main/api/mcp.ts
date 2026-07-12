import type { McpApiContext } from '@your-app-name/api/mcp'

import type { CreateApiContext } from './types'

export const createMcpContext: CreateApiContext<McpApiContext> = ({ appContext }) => {
  return {
    getMcpServer: () => appContext.mcpServer,
    setMcpServer: (server) => {
      appContext.mcpServer = server
    },
  }
}
