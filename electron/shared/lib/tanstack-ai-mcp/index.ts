import { Client } from '@modelcontextprotocol/sdk/client'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { StreamableHTTPClientTransportOptions } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { ListToolsRequest, Tool as McpTool } from '@modelcontextprotocol/sdk/types.js'
import { toolDefinition } from '@tanstack/ai'
import type { ServerTool } from '@tanstack/ai'

type ListToolsOptions = {
  params?: ListToolsRequest['params']
  options?: RequestOptions
}
type StdioOption = StdioServerParameters
type HttpOption = { url: string } & StreamableHTTPClientTransportOptions

export async function mcpToTanStackAiTools(options: {
  stdioOptions: StdioOption
  listToolsOptions?: ListToolsOptions
}): Promise<ServerTool[]>
export async function mcpToTanStackAiTools(options: {
  httpOptions: HttpOption
  listToolsOptions?: ListToolsOptions
}): Promise<ServerTool[]>
export async function mcpToTanStackAiTools(options: {
  transport: Transport
  listToolsOptions?: ListToolsOptions
}): Promise<ServerTool[]>
export async function mcpToTanStackAiTools(options: {
  client: Client
  listToolsOptions?: ListToolsOptions
}): Promise<ServerTool[]>
export async function mcpToTanStackAiTools(
  options:
    | {
        stdioOptions: StdioOption
        listToolsOptions?: ListToolsOptions
      }
    | {
        httpOptions: HttpOption
        listToolsOptions?: ListToolsOptions
      }
    | {
        transport: Transport
        listToolsOptions?: ListToolsOptions
      }
    | {
        client: Client
        listToolsOptions?: ListToolsOptions
      },
): Promise<ServerTool[]> {
  if ('stdioOptions' in options) {
    return mcpToTanStackAiTools_stdio(options.stdioOptions, options.listToolsOptions)
  } else if ('httpOptions' in options) {
    return mcpToTanStackAiTools_http(options.httpOptions, options.listToolsOptions)
  } else if ('client' in options) {
    return mcpToTanStackAiTools_client(options.client, options.listToolsOptions)
  } else if ('transport' in options) {
    return mcpToTanStackAiTools_transport(options.transport, options.listToolsOptions)
  } else {
    throw new Error('Invalid options provided to mcpToTanStackAiTools')
  }
}

async function mcpToTanStackAiTools_stdio(
  stdioOptions: StdioOption,
  listToolsOptions?: ListToolsOptions,
) {
  const client = new Client({
    name: 'tanstack-ai-mcp-tools',
    version: '1',
  })
  const transport = new StdioClientTransport(stdioOptions)
  await client.connect(transport)
  return mcpToTanStackAiTools_client(client, listToolsOptions)
}

async function mcpToTanStackAiTools_http(
  httpOptions: HttpOption,
  listToolsOptions?: ListToolsOptions,
) {
  const client = new Client({
    name: 'tanstack-ai-mcp-tools',
    version: '1',
  })
  const { url, ...transportOptions } = httpOptions
  const transport = new StreamableHTTPClientTransport(new URL(url), transportOptions)
  await client.connect(transport)
  return mcpToTanStackAiTools_client(client, listToolsOptions)
}

async function mcpToTanStackAiTools_transport(
  transport: Transport,
  listToolsOptions?: ListToolsOptions,
) {
  const client = new Client({
    name: 'tanstack-ai-mcp-tools',
    version: '1',
  })
  await client.connect(transport)
  return mcpToTanStackAiTools_client(client, listToolsOptions)
}

async function mcpToTanStackAiTools_client(client: Client, listToolsOptions?: ListToolsOptions) {
  const mcpTools = await retrieveMcpTools(client, listToolsOptions)
  return mcpToolsToTanStackAiTools(mcpTools, client)
}

export async function retrieveMcpTools(client: Client, listToolsOptions?: ListToolsOptions) {
  const { params = {}, options = {} } = listToolsOptions ?? {}
  let cursor: string | undefined
  const allTools: McpTool[] = []

  do {
    const result = await client.listTools(params, options)
    allTools.push(...result.tools)
    cursor = result.nextCursor
  } while (cursor)

  return allTools
}

export function mcpToolToTanStackAiToolDef(mcpTool: McpTool) {
  return toolDefinition({
    name: mcpTool.name,
    description: mcpTool.description ?? '',
    inputSchema: mcpTool.inputSchema ?? undefined,
    outputSchema: mcpTool.outputSchema ?? undefined,
  })
}

export function mcpToolsToTanStackAiToolDefs(mcpTools: McpTool[]) {
  return mcpTools.map(mcpToolToTanStackAiToolDef)
}

export function mcpToolToTanStackAiTool(mcpTool: McpTool, client: Client) {
  const toolDef = mcpToolToTanStackAiToolDef(mcpTool)
  toolDef.server(async (args: any) => {
    const result = await client.callTool({
      name: toolDef.name,
      arguments: args,
    })
    return result
  })
}

export function mcpToolsToTanStackAiTools(mcpTools: McpTool[], client: Client) {
  const toolDefs = mcpToolsToTanStackAiToolDefs(mcpTools)
  return toolDefs.map((toolDef) =>
    toolDef.server(async (args: any) => {
      const result = await client.callTool({
        name: toolDef.name,
        arguments: args,
      })
      return result
    }),
  )
}
