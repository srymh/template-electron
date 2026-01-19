/**
 * Proof of Concept: WebSocket Transport Server
 *
 * This demonstrates setting up a WebSocket RPC server that handles
 * the same API as the Electron IPC implementation.
 */

import { WebSocketServerTransport } from '../shared/transport/websocket/server'
import { getThemeApi } from '../electron/main/features/theme'

/**
 * Start a WebSocket RPC server
 */
export async function startWebSocketServer(port: number = 9876): Promise<WebSocketServerTransport> {
  const transport = new WebSocketServerTransport({
    port,
    host: 'localhost', // Security: bind to localhost only
  })

  // Register theme API handlers as a demonstration
  const themeApi = getThemeApi()

  // Register invoke handlers
  transport.handleInvoke('theme.getTheme', async () => {
    // Note: WebContents is not available in WebSocket context
    // In production, consider one of these approaches:
    // 1. Create WebSocket-specific API adapters that don't require WebContents
    // 2. Use a context object that works for both IPC and WebSocket
    // 3. Define APIs with optional WebContents: (webContents?: WebContents)
    // For this PoC, we pass null as a placeholder
    return themeApi.getTheme(null as any)
  })

  transport.handleInvoke('theme.setTheme', async (options: { theme: any }) => {
    // TODO: Use proper Theme type instead of any
    return themeApi.setTheme(options, null as any)
  })

  transport.handleInvoke('theme.getAccentColor', async () => {
    return themeApi.getAccentColor(null as any)
  })

  // Register event handlers
  transport.handleEvent('theme.on.accentColorChanged', (sendData) => {
    // Subscribe to the event and return unsubscribe function
    return themeApi.on.accentColorChanged((color) => {
      sendData(color)
    }, null as any)
  })

  transport.handleEvent('theme.on.updated', (sendData) => {
    return themeApi.on.updated((theme) => {
      sendData(theme)
    }, null as any)
  })

  await transport.start()
  console.log(`WebSocket RPC server started on localhost:${port}`)

  return transport
}

/**
 * Example usage in main process
 *
 * This could be called when the Electron app starts:
 *
 * ```typescript
 * import { startWebSocketServer } from './poc/websocket-server'
 *
 * // Start WebSocket server alongside IPC
 * const wsServer = await startWebSocketServer(9876)
 *
 * // Later, to stop:
 * await wsServer.stop()
 * ```
 */
