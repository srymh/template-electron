import type { ApiInterface, WithCallerKey, WithCallerKeyApi } from '@repo/ipc'
import { startServer as startMcpServer } from '@repo/mcp-server-example'
import type { McpServer } from '@repo/mcp-server-example'

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
  <TKey>(
    getContext: (key: TKey) => McpApiContext,
  ): WithCallerKey<McpApi['getServerStatus'], TKey> =>
  async (key) => {
    const { getMcpServer } = getContext(key)

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
  <TKey>(getContext: (key: TKey) => McpApiContext): WithCallerKey<McpApi['startServer'], TKey> =>
  async ({ port }, key) => {
    const { getMcpServer, setMcpServer } = getContext(key)

    let server = getMcpServer()
    if (!server) {
      server = startMcpServer({ port })
      setMcpServer(server)
    }
  }

const stopServerFn =
  <TKey>(getContext: (key: TKey) => McpApiContext): WithCallerKey<McpApi['stopServer'], TKey> =>
  async (key) => {
    const { getMcpServer, setMcpServer } = getContext(key)

    let server = getMcpServer()
    if (server) {
      server.stop()
      setMcpServer(null)
    }
  }

export function getMcpApi<TKey>(
  getContext: (key: TKey) => McpApiContext,
): WithCallerKeyApi<McpApi, TKey> {
  return {
    getServerStatus: getServerStatusFn(getContext),
    startServer: startServerFn(getContext),
    stopServer: stopServerFn(getContext),
  }
}
