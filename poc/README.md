# Transport-Agnostic RPC - Proof of Concept

This directory contains proof-of-concept implementations demonstrating how to use different transports (IPC, WebSocket) with the same type-safe API.

## Overview

The transport abstraction allows you to:

1. **Use the same type definitions** for different transports
2. **Switch between IPC and WebSocket** without changing API calls
3. **Support non-Electron environments** (browsers, Node.js) using WebSocket
4. **Test more easily** by mocking transports

## Files

- `websocket-server.ts` - WebSocket server implementation for the main process
- `websocket-client.ts` - WebSocket client for renderer/browser
- `README.md` - This file

## Security Considerations

### WebSocket Transport Security

When using WebSocket transport instead of IPC:

1. **Localhost Binding**: The WebSocket server binds to `localhost` only by default
   - This prevents external network access
   - Only processes on the same machine can connect

2. **Authentication** (TODO for production):
   - Consider adding token-based authentication
   - Example: Generate a random token on server start, pass to authorized clients only

3. **Origin Checking** (TODO for production):
   - Verify the Origin header for WebSocket connections
   - Reject connections from unauthorized origins

4. **Method Allowlist** (TODO for production):
   - Limit which API methods are exposed via WebSocket
   - Some methods may be too sensitive for non-IPC transport

5. **Rate Limiting** (TODO for production):
   - Add rate limiting to prevent abuse
   - Especially important for expensive operations

## Example Usage

### Starting the WebSocket Server (Main Process)

\`\`\`typescript
import { startWebSocketServer } from './poc/websocket-server'

// Start alongside IPC
const wsServer = await startWebSocketServer(9876)

// Later, to stop
await wsServer.stop()
\`\`\`

### Using the WebSocket Client (Renderer/Browser)

\`\`\`typescript
import { createWebSocketClient } from './poc/websocket-client'

// Connect to the server
const { api, transport } = await createWebSocketClient('ws://localhost:9876')

// Use the API - same interface as IPC!
const theme = await api.theme.getTheme()
console.log('Current theme:', theme)

// Subscribe to events
const removeListener = api.theme.on.updated((newTheme) => {
  console.log('Theme updated:', newTheme)
})

// Cleanup
removeListener()
transport.close()
\`\`\`

### Using IPC Transport (Default)

The existing implementation already uses IPC. To make it explicit:

\`\`\`typescript
import { IpcTransport } from '../shared/transport/ipc/client'
import { createElectronApiWithTransport } from '../electron/main/lib/ipc/transport'

// Create IPC transport
const transport = new IpcTransport()

// Create API with IPC transport
const api = createElectronApiWithTransport(
  transport,
  createMainApiFunc,
  createRendererApiFunc,
  { registeredEventMap: new Map() }
)
\`\`\`

## Testing

The transport abstraction makes testing easier:

\`\`\`typescript
// Mock transport for testing
class MockTransport implements RpcTransport {
  async invoke(channel: string, ...args: any[]) {
    // Return test data
    if (channel === 'theme.getTheme') {
      return 'dark'
    }
  }

  subscribe(channel: string, listener: (data: any) => void) {
    // Mock event subscription
    return () => {}
  }
}

// Use in tests
const mockTransport = new MockTransport()
const api = createElectronApiWithTransport(mockTransport, ...)
\`\`\`

## Serialization Constraints

When using WebSocket transport (or any non-IPC transport):

- **JSON serialization**: Data is serialized as JSON
- **No ArrayBuffer**: Cannot directly send ArrayBuffer (would need base64 encoding)
- **No Error objects**: Error stack traces are sent as strings
- **No Date objects**: Date objects become strings (need explicit conversion)
- **No Functions**: Cannot serialize functions

For IPC transport, Electron's Structured Clone algorithm handles these better.

## Future Enhancements

1. **HTTP Transport**: Add HTTP/REST transport option
2. **Authentication**: Implement token-based auth for WebSocket
3. **Encryption**: Add TLS/SSL support for secure communication
4. **Compression**: Add message compression for large payloads
5. **Binary Support**: Handle ArrayBuffer/Blob data in WebSocket
6. **Method Allowlist**: Configure which methods are exposed per transport
