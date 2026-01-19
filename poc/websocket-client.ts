/**
 * Proof of Concept: WebSocket Transport Client
 *
 * This demonstrates using WebSocket transport instead of IPC
 * to call the same type-safe API.
 */

import { WebSocketTransport } from '../shared/transport/websocket/client'
import { createElectronApiWithTransport } from '../electron/main/lib/ipc/transport'
import type { ElectronMainApi } from '../electron/main/ipc/electronApi'

/**
 * Create an API client using WebSocket transport
 *
 * This can be used in:
 * - Browser environments (not just Electron renderer)
 * - Testing scenarios
 * - Any environment where you want to use HTTP/WS instead of IPC
 */
export async function createWebSocketClient(url: string = 'ws://localhost:9876') {
  const transport = new WebSocketTransport(url)

  // Connect to the server
  await transport.connect()

  // Create the API using the same structure as IPC version
  // but with WebSocket transport
  const api = createElectronApiWithTransport<ElectronMainApi>(
    transport,
    ({ defineHelper, useChannelAsInvoke, useChannelAsEvent }) =>
      defineHelper({
        // Only including theme API for PoC demonstration
        theme: {
          getTheme: useChannelAsInvoke('theme.getTheme'),
          setTheme: useChannelAsInvoke('theme.setTheme'),
          getAccentColor: useChannelAsInvoke('theme.getAccentColor'),
          on: {
            accentColorChanged: useChannelAsEvent('theme.on.accentColorChanged'),
            updated: useChannelAsEvent('theme.on.updated'),
          },
        },
        // Other APIs would be defined similarly
        fs: {} as any,
        web: {} as any,
        mcp: {} as any,
        aiAgent: {} as any,
        aiChat: {} as any,
        kakeibo: {} as any,
        auth: {} as any,
      }),
    ({ defineHelper }) => defineHelper({}),
    { registeredEventMap: new Map() }
  )

  return { api, transport }
}

/**
 * Example usage:
 *
 * ```typescript
 * import { createWebSocketClient } from './poc/websocket-client'
 *
 * // In renderer or browser
 * const { api, transport } = await createWebSocketClient()
 *
 * // Use the API - same interface as IPC version!
 * const theme = await api.theme.getTheme()
 * console.log('Current theme:', theme)
 *
 * // Subscribe to events
 * const removeListener = api.theme.on.updated((newTheme) => {
 *   console.log('Theme updated:', newTheme)
 * })
 *
 * // Later, cleanup
 * removeListener()
 * transport.close()
 * ```
 */
