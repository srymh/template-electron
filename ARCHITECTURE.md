# Transport-Agnostic RPC Architecture

## Overview

This document describes the transport-agnostic RPC architecture that allows Electron's type-safe IPC system to work with different transport layers (IPC, WebSocket, HTTP, etc.) while maintaining full type safety.

## Problem Statement

The original issue ([#issue_number]) identified that the current `preload` + `electronApi` approach is:
- Type-safe and compact
- But tightly coupled to Electron IPC
- Could benefit from transport abstraction to enable:
  - HTTP/WebSocket communication (non-Electron environments)
  - Easier testing with mock transports
  - Future extensibility

## Architecture Components

### 1. Transport Protocol (`shared/transport/types.ts`)

Defines a common message protocol for RPC communication:

```typescript
// Message types
type MessageType = 
  | 'invoke-request'      // Method call request
  | 'invoke-response'     // Method call response
  | 'event-subscribe'     // Subscribe to events
  | 'event-unsubscribe'   // Unsubscribe from events
  | 'event-data'          // Event data push

// Each message has a correlation ID for matching requests/responses
interface BaseMessage {
  type: MessageType
  id: string  // Correlation ID
}
```

### 2. Transport Interface

Two core interfaces define transport capabilities:

**Client-side (RpcTransport):**
```typescript
interface RpcTransport {
  invoke(channel: string, ...args: any[]): Promise<any>
  subscribe(channel: string, listener: (data: any) => void): () => void
  close?(): void
}
```

**Server-side (ServerTransport):**
```typescript
interface ServerTransport {
  handleInvoke(channel: string, handler: (...args: any[]) => Promise<any>): void
  handleEvent(channel: string, onSubscribe: (sendData: (data: any) => void) => () => void): void
  start?(): Promise<void>
  stop?(): Promise<void>
}
```

### 3. Transport Implementations

#### IPC Transport (`shared/transport/ipc/client.ts`)
- Wraps Electron's `ipcRenderer`
- Maintains compatibility with existing IPC code
- Uses `channel::response` convention for events

#### WebSocket Transport (`shared/transport/websocket/`)
- **Client** (`client.ts`): Browser-compatible WebSocket client
- **Server** (`server.ts`): Node.js WebSocket server using `ws` package
- Implements message protocol with JSON serialization
- Includes reconnection logic
- Binds to localhost by default for security

### 4. API Creation (`electron/main/lib/ipc/transport/createApiWithTransport.ts`)

Creates type-safe API using any transport:

```typescript
const api = createElectronApiWithTransport(
  transport,  // IpcTransport or WebSocketTransport
  createMainApi,
  createRendererApi,
  { registeredEventMap: new Map() }
)
```

This function:
- Accepts any `RpcTransport` implementation
- Generates type-safe invoke/event helpers
- Returns frozen API object
- Maintains full TypeScript type inference

## Data Flow

### Invoke Request/Response

```
Client                   Transport                  Server
  |                          |                         |
  |-- invoke(channel, args) ->|                        |
  |                          |-- InvokeRequestMessage ->|
  |                          |                         |-- handler(...args)
  |                          |<- InvokeResponseMessage -|
  |<- Promise<result> -------|                         |
```

### Event Subscription

```
Client                   Transport                  Server
  |                          |                         |
  |-- subscribe(channel, listener) ->|                 |
  |                          |-- EventSubscribeMessage ->|
  |                          |                         |-- addEventListener()
  |                          |<- EventDataMessage -------|
  |-- listener(data) --------|                         |
```

## Type Safety Preservation

The system maintains type safety through several mechanisms:

1. **Type-level path extraction**: `RecursiveMethodKeys<T>` extracts all valid channel paths
2. **Method signature preservation**: `ExtractMethod<T, Path>` maintains parameter/return types
3. **Transport-agnostic helpers**: `useChannelAsInvoke` and `useChannelAsEvent` work with any transport
4. **Compile-time validation**: Invalid channels cause TypeScript errors

Example:
```typescript
type API = {
  theme: {
    getTheme: () => Promise<'dark' | 'light'>
    on: {
      updated: (listener: (theme: string) => void) => () => void
    }
  }
}

// ✅ Valid - type-safe
const theme = await api.theme.getTheme()  // theme: 'dark' | 'light'

// ❌ Compile error - invalid channel
const invalid = await api.theme.invalidMethod()
```

## Security Considerations

### WebSocket-Specific Security

1. **Localhost Binding**
   - Default: `host: 'localhost'`
   - Prevents external network access
   - Only local processes can connect

2. **Authentication** (TODO for production)
   ```typescript
   // Generate token on server start
   const token = crypto.randomBytes(32).toString('hex')
   
   // Client must provide token
   wsClient.send({ token, ...message })
   ```

3. **Origin Checking** (TODO for production)
   ```typescript
   server.on('connection', (ws, req) => {
     const origin = req.headers.origin
     if (!allowedOrigins.includes(origin)) {
       ws.close(1008, 'Unauthorized origin')
     }
   })
   ```

4. **Method Allowlist** (TODO for production)
   ```typescript
   const allowedChannels = new Set([
     'theme.getTheme',
     'theme.setTheme',
     // ... only safe methods
   ])
   ```

5. **Rate Limiting** (TODO for production)
   - Limit requests per second per client
   - Prevent DoS attacks

### General Security

- **Input Validation**: Always validate arguments on server side
- **Error Handling**: Don't leak sensitive info in error messages
- **Logging**: Log all requests for security auditing

## Serialization Constraints

Different transports have different serialization capabilities:

| Feature | Electron IPC | WebSocket/HTTP |
|---------|-------------|----------------|
| Primitives | ✅ | ✅ |
| Objects/Arrays | ✅ | ✅ |
| ArrayBuffer | ✅ | ⚠️ Need base64 |
| Error objects | ✅ | ⚠️ Message only |
| Date objects | ✅ | ⚠️ String only |
| Functions | ❌ | ❌ |
| Circular refs | ❌ | ❌ |

**Recommendations:**
- Use plain objects for API parameters/returns
- Serialize ArrayBuffer to base64 for non-IPC transports
- Convert Dates to ISO strings or timestamps
- Don't pass functions or circular references

## Testing Strategy

### Unit Testing with Mock Transport

```typescript
const mockTransport: RpcTransport = {
  invoke: vi.fn(async (channel, ...args) => {
    return testData[channel]
  }),
  subscribe: vi.fn((channel, listener) => {
    return () => {}  // unsubscribe
  })
}

const api = createElectronApiWithTransport(mockTransport, ...)
```

### Integration Testing

1. **IPC Tests**: Use existing Electron test infrastructure
2. **WebSocket Tests**: Start server, connect client, verify messages
3. **Cross-transport Tests**: Same test suite for all transports

## Migration Path

### Phase 1: Add Abstraction (✅ Complete)
- Create transport interfaces
- Implement IPC adapter
- Add `createElectronApiWithTransport`
- Maintain backward compatibility

### Phase 2: WebSocket PoC (✅ Complete)
- Implement WebSocket transport
- Create example server/client
- Document security considerations
- Test with subset of APIs

### Phase 3: Production Readiness (TODO)
- Add authentication
- Add origin checking
- Add method allowlist
- Add rate limiting
- Add TLS/SSL support
- Performance testing

### Phase 4: Full Adoption (TODO)
- Migrate all API registrations
- Update documentation
- Add monitoring/logging
- Production deployment

## Example Usage

### Using IPC (Default)

```typescript
// preload/index.ts
import { electronApi } from '../main/ipc/electronApi'
contextBridge.exposeInMainWorld('electronApi', electronApi)

// renderer
const theme = await window.electronApi.theme.getTheme()
```

### Using WebSocket

```typescript
// main process
import { startWebSocketServer } from './poc/websocket-server'
const wsServer = await startWebSocketServer(9876)

// renderer/browser
import { createWebSocketClient } from './poc/websocket-client'
const { api } = await createWebSocketClient('ws://localhost:9876')
const theme = await api.theme.getTheme()
```

## Future Enhancements

1. **HTTP Transport**: REST API support
2. **gRPC Transport**: For high-performance scenarios
3. **Message Compression**: Reduce bandwidth for large payloads
4. **Binary Protocol**: More efficient than JSON
5. **Streaming**: Support streaming responses for large data
6. **Multiplexing**: Multiple logical channels over one connection

## References

- Issue: [Transport-agnostic type-safe RPC abstraction]
- Code: `shared/transport/`, `electron/main/lib/ipc/transport/`
- Examples: `poc/`
- Tests: `electron/main/lib/ipc/transport/*.test.ts`
