import { startServer as startMcpServer } from '../features/mcp'

import type { WebContents } from 'electron'
import type { McpServer } from '../features/mcp'
import type {
  ApiInterface,
  WithWebContents,
  WithWebContentsApi,
} from '../lib/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const MCP_API_KEY = 'mcp' as const
export type McpApiKey = typeof MCP_API_KEY

export type McpApiContext = {
  getMcpServer: () => McpServer | null
  setMcpServer: (server: McpServer | null) => void
}

// -----------------------------------------------------------------------------
// インターフェイス定義

export type McpApi = ApiInterface<{
  getServerStatus: () => Promise<{
    isRunning: boolean
    port: number
  }>
  startServer: (options: { port?: number }) => Promise<void>
  stopServer: () => Promise<void>
}>

// -----------------------------------------------------------------------------
// 実装

const getServerStatusFn =
  (
    getContext: (webContents: WebContents) => McpApiContext,
  ): WithWebContents<McpApi['getServerStatus']> =>
  async (webContents) => {
    const { getMcpServer } = getContext(webContents)

    const server = getMcpServer()

    if (server) {
      console.log('MCP server is running')
      return {
        isRunning: true,
        port: server.port,
      }
    }

    console.log('MCP server is not running')
    return {
      isRunning: false,
      port: 0,
    }
  }

const startServerFn =
  (
    getContext: (webContents: WebContents) => McpApiContext,
  ): WithWebContents<McpApi['startServer']> =>
  async ({ port }, webContents) => {
    const { getMcpServer, setMcpServer } = getContext(webContents)

    let server = getMcpServer()
    if (!server) {
      server = startMcpServer({ port })
      setMcpServer(server)
    }
  }

const stopServerFn =
  (
    getContext: (webContents: WebContents) => McpApiContext,
  ): WithWebContents<McpApi['stopServer']> =>
  async (webContents) => {
    const { getMcpServer, setMcpServer } = getContext(webContents)

    let server = getMcpServer()
    if (server) {
      server.stop()
      setMcpServer(null)
    }
  }

export function getMcpApi(
  getContext: (webContents: WebContents) => McpApiContext,
): WithWebContentsApi<McpApi> {
  return {
    getServerStatus: getServerStatusFn(getContext),
    startServer: startServerFn(getContext),
    stopServer: stopServerFn(getContext),
  }
}
