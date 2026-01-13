import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer } from './mcpServer.js'

export type McpServer = {
  port: number
  stop: () => void
}

export function startServer(options: { port?: number }): McpServer {
  const { port = 3030 } = options

  const mcpServer = createMcpServer()

  const app = express()
  app.use(express.json())

  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      /**
       * 接続不可になる。原因不明
       * Error: MCP server could not be started: 403 status sending message
       * to http://localhost:3000/mcp: {"jsonrpc":"2.0","error":{"code":-32000,
       * "message":"Invalid Host header: localhost:3000"},"id":null}
       */
      // enableDnsRebindingProtection: true,
      // allowedHosts: ["127.0.0.1", "localhost"],
    })

    res.on('close', () => {
      transport.close()
    })

    await mcpServer.connect(transport)
    await transport.handleRequest(req, res, req.body)
  })

  const httpServer = app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
  })

  const stopServer = () => {
    mcpServer.close()
    httpServer.close()
  }

  return {
    port,
    stop: stopServer,
  }
}
