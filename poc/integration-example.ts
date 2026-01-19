/**
 * Integration Example: Using WebSocket Transport
 *
 * This example shows how to integrate WebSocket transport
 * into the existing Electron application.
 */

import { WebSocketServerTransport } from '../shared/transport/websocket/server'
import type { Context } from '../electron/main/ipc/register'
import type { WebContents } from 'electron'
import type { IpcRegistrationMap } from '../electron/main/lib/ipc/shared/types'
import type { ElectronMainApi } from '../electron/main/ipc/electronApi'

/**
 * Register all APIs on WebSocket transport
 *
 * This takes the same registration map used for IPC and adapts it
 * to work with WebSocket transport.
 *
 * Note: getContext parameter would be used for context-aware APIs
 * but is not used in this simplified example.
 */
export function registerWebSocketHandlers(
  transport: WebSocketServerTransport,
  _getContext: (webContents?: WebContents) => Context,
  registrationMap: IpcRegistrationMap<ElectronMainApi>
) {
  for (const [channel, entry] of Object.entries(registrationMap)) {
    if (entry.type === 'invoke') {
      // Register invoke handler
      transport.handleInvoke(channel, async (...args: Array<any>) => {
        // WebSocket doesn't have WebContents, so we pass undefined
        // The API implementation should handle this gracefully
        // Note: getContext is available but not used in this simple example
        return entry.method(...args, undefined as any)
      })
    } else {
      // Register event handler (entry.type === 'event')
      transport.handleEvent(channel, (sendData) => {
        // Subscribe to the event and send data to WebSocket client
        return entry.addEventListener((data: any) => {
          sendData(data)
        }, undefined as any)
      })
    }
  }
}

/**
 * Example: Start WebSocket server with all APIs
 *
 * This shows how to start a WebSocket server that exposes
 * the same APIs as the IPC implementation.
 *
 * Note: getContext parameter would be used when registering handlers
 * but is not used in this simplified example.
 */
export async function startFullWebSocketServer(
  port: number = 9876,
  _getContext?: (webContents?: WebContents) => Context
): Promise<WebSocketServerTransport> {
  // Create WebSocket server
  const transport = new WebSocketServerTransport({
    port,
    host: 'localhost', // Security: localhost only
  })

  // You would need to get the registration map from registerIpc
  // For now, this is a simplified example
  // In practice, you'd need to refactor registerIpc to expose the map

  // Start the server
  await transport.start()
  console.log(`Full WebSocket RPC server started on localhost:${port}`)

  return transport
}

/**
 * Usage in main process (electron/main/index.ts):
 *
 * ```typescript
 * import { startFullWebSocketServer } from './integration/websocket-integration'
 * import { app } from 'electron'
 *
 * app.whenReady().then(async () => {
 *   // Start IPC (existing)
 *   registerIpc({ getContext, cache: new WeakMap() })
 *
 *   // Optionally start WebSocket server alongside IPC
 *   if (process.env.ENABLE_WS_SERVER) {
 *     const wsServer = await startFullWebSocketServer(9876, getContext)
 *
 *     // Clean up on quit
 *     app.on('before-quit', async () => {
 *       await wsServer.stop()
 *     })
 *   }
 * })
 * ```
 */
