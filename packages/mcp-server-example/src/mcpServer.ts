import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export function createMcpServer() {
  const server = new McpServer({
    name: 'Demo',
    version: '1.0.0',
  })

  server.registerTool(
    `print_hello`,
    {
      title: 'ユーザーが指示したメッセージをログに出力します。',
      description: `ユーザーが指示したメッセージをログに出力します。`,
      inputSchema: {
        message: z.string(),
      },
    },
    async ({ message }) => {
      console.log(message)
      return {
        content: [{ type: 'text', text: `ログに「${message}」を出力しました。` }],
      }
    },
  )

  return server
}
