import { nativeTheme } from 'electron'
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
        content: [
          { type: 'text', text: `ログに「${message}」を出力しました。` },
        ],
      }
    },
  )

  server.registerTool(
    `change_theme`,
    {
      title: 'テーマ変更',
      description: `テーマを変更します。lightかdarkを指定してください。`,
      inputSchema: {
        theme: z.enum(['light', 'dark']),
      },
    },
    async ({ theme }) => {
      nativeTheme.themeSource = theme
      console.log('theme', theme)
      return {
        content: [
          { type: 'text', text: `テーマを「${theme}」に変更しました。` },
        ],
      }
    },
  )

  return server
}
