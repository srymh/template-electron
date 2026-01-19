# Quick Start: Using Transport Abstraction

This guide shows you how to use the transport abstraction in your Electron app.

## Default Usage (No Changes Required)

The existing IPC implementation continues to work as-is. No changes needed:

```typescript
// preload/index.ts
import { electronApi } from '../main/ipc/electronApi'
contextBridge.exposeInMainWorld('electronApi', electronApi)

// renderer
const theme = await window.electronApi.theme.getTheme()
```

## Using WebSocket Transport

### Step 1: Start WebSocket Server (Main Process)

Add to your main process initialization:

```typescript
// electron/main/index.ts
import { startWebSocketServer } from './poc/websocket-server'

app.whenReady().then(async () => {
  // Existing IPC setup
  registerIpc({ getContext, cache: new WeakMap() })
  
  // Optional: Add WebSocket server
  if (process.env.ENABLE_WS_SERVER === 'true') {
    const wsServer = await startWebSocketServer(9876)
    
    app.on('before-quit', async () => {
      await wsServer.stop()
    })
  }
})
```

### Step 2: Connect from Renderer/Browser

In your renderer process or web browser:

```typescript
import { WebSocketTransport } from '../shared/transport/websocket/client'
import { createElectronApiWithTransport } from '../electron/main/lib/ipc/transport'

// Connect to WebSocket server
const transport = new WebSocketTransport('ws://localhost:9876')
await transport.connect()

// Create API using WebSocket transport
const api = createElectronApiWithTransport(
  transport,
  ({ defineHelper, useChannelAsInvoke, useChannelAsEvent }) =>
    defineHelper({
      theme: {
        getTheme: useChannelAsInvoke('theme.getTheme'),
        setTheme: useChannelAsInvoke('theme.setTheme'),
        on: {
          updated: useChannelAsEvent('theme.on.updated'),
        },
      },
      // ... other APIs
    }),
  ({ defineHelper }) => defineHelper({}),
  { registeredEventMap: new Map() }
)

// Use the API - same interface as IPC!
const theme = await api.theme.getTheme()

// Subscribe to events
const unsubscribe = api.theme.on.updated((newTheme) => {
  console.log('Theme changed:', newTheme)
})

// Cleanup
unsubscribe()
transport.close()
```

## Creating a Custom Transport

You can implement any transport by implementing the `RpcTransport` interface:

```typescript
import type { RpcTransport } from '../shared/transport/types'

class MyCustomTransport implements RpcTransport {
  async invoke(channel: string, ...args: any[]): Promise<any> {
    // Your invoke implementation
    // Example: HTTP POST, gRPC call, etc.
  }

  subscribe(channel: string, listener: (data: any) => void): () => void {
    // Your subscription implementation
    // Example: Server-Sent Events, long polling, etc.
    
    // Return unsubscribe function
    return () => {
      // Cleanup
    }
  }

  close(): void {
    // Cleanup resources
  }
}

// Use your custom transport
const transport = new MyCustomTransport()
const api = createElectronApiWithTransport(transport, ...)
```

## Testing with Mock Transport

Create a mock transport for unit testing:

```typescript
import { describe, it, expect, vi } from 'vitest'
import type { RpcTransport } from '../shared/transport/types'

describe('My Component', () => {
  it('calls theme API', async () => {
    // Create mock transport
    const mockTransport: RpcTransport = {
      invoke: vi.fn(async (channel, ...args) => {
        if (channel === 'theme.getTheme') return 'dark'
        if (channel === 'theme.setTheme') return undefined
        throw new Error(`Unknown channel: ${channel}`)
      }),
      subscribe: vi.fn((channel, listener) => {
        // Mock subscription
        return () => {} // unsubscribe
      }),
    }

    // Create API with mock transport
    const api = createElectronApiWithTransport(mockTransport, ...)

    // Test your code
    const theme = await api.theme.getTheme()
    expect(theme).toBe('dark')
    expect(mockTransport.invoke).toHaveBeenCalledWith('theme.getTheme')
  })
})
```

## Environment Variables

Control transport behavior with environment variables:

```bash
# Enable WebSocket server
ENABLE_WS_SERVER=true npm run dev

# Configure WebSocket port
WS_PORT=9876 npm run dev
```

## Security Checklist

Before deploying WebSocket transport to production:

- [ ] Add authentication tokens
- [ ] Implement origin checking
- [ ] Add method allowlist (only expose safe APIs)
- [ ] Add rate limiting
- [ ] Use TLS/SSL (wss://)
- [ ] Add request logging
- [ ] Implement timeout handling
- [ ] Add error monitoring

See `poc/README.md` and `ARCHITECTURE.md` for detailed security guidelines.

## Common Issues

### WebSocket connection refused

- Ensure WebSocket server is started (`ENABLE_WS_SERVER=true`)
- Check port is not already in use
- Verify localhost binding

### Type errors

- Ensure transport is properly typed
- Check API definitions match on client and server
- Verify all channels are registered

### Events not working

- Check subscription is called before events are emitted
- Verify unsubscribe is not called prematurely
- Check WebSocket connection is active

## Next Steps

1. Review `ARCHITECTURE.md` for design details
2. See `poc/` directory for working examples
3. Check existing tests in `electron/main/lib/ipc/transport/*.test.ts`
4. Read security considerations in `poc/README.md`

## Support

For questions or issues:
1. Check `ARCHITECTURE.md` for design decisions
2. Review PoC examples in `poc/` directory
3. Open an issue on GitHub
