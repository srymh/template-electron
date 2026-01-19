/**
 * WebSocket Server Transport for RPC
 *
 * Server-side WebSocket transport implementation for Node.js/Electron main process
 */

import { WebSocket, WebSocketServer } from 'ws'
import type { EventSubscribeMessage, EventUnsubscribeMessage, InvokeRequestMessage, RpcMessage, ServerTransport } from '../types'

/**
 * Client connection state
 */
interface ClientState {
  ws: WebSocket
  subscriptions: Map<string, () => void> // channel -> unsubscribe function
}

/**
 * Server-side WebSocket transport
 */
export class WebSocketServerTransport implements ServerTransport {
  private server: WebSocketServer | null = null
  private clients = new Map<WebSocket, ClientState>()
  private invokeHandlers = new Map<string, (...args: Array<any>) => Promise<any>>()
  private eventHandlers = new Map<string, (sendData: (data: any) => void) => () => void>()

  constructor(
    private options: {
      port: number
      host?: string
    }
  ) {}

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({
          port: this.options.port,
          host: this.options.host || 'localhost', // Bind to localhost only for security
        })

        this.server.on('connection', (ws) => {
          this.handleConnection(ws)
        })

        this.server.on('listening', () => {
          console.log(`WebSocket server listening on ${this.options.host || 'localhost'}:${this.options.port}`)
          resolve()
        })

        this.server.on('error', (error) => {
          console.error('WebSocket server error:', error)
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Handle new client connection
   */
  private handleConnection(ws: WebSocket): void {
    console.log('New WebSocket client connected')

    const clientState: ClientState = {
      ws,
      subscriptions: new Map(),
    }
    this.clients.set(ws, clientState)

    ws.on('message', (data) => {
      this.handleMessage(ws, data.toString())
    })

    ws.on('close', () => {
      this.handleDisconnect(ws)
    })

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error)
    })
  }

  /**
   * Handle incoming message from client
   */
  private async handleMessage(ws: WebSocket, data: string): Promise<void> {
    try {
      const message: RpcMessage = JSON.parse(data)

      switch (message.type) {
        case 'invoke-request':
          await this.handleInvokeRequest(ws, message)
          break
        case 'event-subscribe':
          this.handleEventSubscribe(ws, message)
          break
        case 'event-unsubscribe':
          this.handleEventUnsubscribe(ws, message)
          break
      }
    } catch (error) {
      console.error('Failed to handle WebSocket message:', error)
    }
  }

  /**
   * Handle invoke request
   */
  private async handleInvokeRequest(ws: WebSocket, message: InvokeRequestMessage): Promise<void> {
    const handler = this.invokeHandlers.get(message.channel)

    if (!handler) {
      this.sendMessage(ws, {
        type: 'invoke-response',
        id: message.id,
        success: false,
        error: {
          message: `No handler registered for channel: ${message.channel}`,
        },
      })
      return
    }

    try {
      const result = await handler(...message.args)
      this.sendMessage(ws, {
        type: 'invoke-response',
        id: message.id,
        success: true,
        result,
      })
    } catch (error) {
      this.sendMessage(ws, {
        type: 'invoke-response',
        id: message.id,
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      })
    }
  }

  /**
   * Handle event subscription
   */
  private handleEventSubscribe(ws: WebSocket, message: EventSubscribeMessage): void {
    const clientState = this.clients.get(ws)
    if (!clientState) return

    const handler = this.eventHandlers.get(message.channel)
    if (!handler) {
      console.warn(`No event handler registered for channel: ${message.channel}`)
      return
    }

    // If already subscribed, do nothing
    if (clientState.subscriptions.has(message.channel)) {
      return
    }

    // Create a function to send data to this specific client
    const sendData = (data: any) => {
      this.sendMessage(ws, {
        type: 'event-data',
        id: message.id,
        channel: message.channel,
        data,
      })
    }

    // Subscribe and store the unsubscribe function
    const unsubscribe = handler(sendData)
    clientState.subscriptions.set(message.channel, unsubscribe)

    console.log(`Client subscribed to ${message.channel}`)
  }

  /**
   * Handle event unsubscription
   */
  private handleEventUnsubscribe(ws: WebSocket, message: EventUnsubscribeMessage): void {
    const clientState = this.clients.get(ws)
    if (!clientState) return

    const unsubscribe = clientState.subscriptions.get(message.channel)
    if (unsubscribe) {
      unsubscribe()
      clientState.subscriptions.delete(message.channel)
      console.log(`Client unsubscribed from ${message.channel}`)
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(ws: WebSocket): void {
    console.log('WebSocket client disconnected')

    const clientState = this.clients.get(ws)
    if (clientState) {
      // Unsubscribe from all events
      for (const unsubscribe of clientState.subscriptions.values()) {
        unsubscribe()
      }
      clientState.subscriptions.clear()
    }

    this.clients.delete(ws)
  }

  /**
   * Send a message to a client
   */
  private sendMessage(ws: WebSocket, message: RpcMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  /**
   * Register a handler for invoke requests
   */
  handleInvoke(channel: string, handler: (...args: Array<any>) => Promise<any>): void {
    this.invokeHandlers.set(channel, handler)
    console.log(`WebSocket invoke handler registered for: ${channel}`)
  }

  /**
   * Register a handler for event subscriptions
   */
  handleEvent(
    channel: string,
    onSubscribe: (sendData: (data: any) => void) => () => void
  ): void {
    this.eventHandlers.set(channel, onSubscribe)
    console.log(`WebSocket event handler registered for: ${channel}`)
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve()
        return
      }

      // Close all client connections
      for (const [ws, clientState] of this.clients.entries()) {
        // Unsubscribe from all events
        for (const unsubscribe of clientState.subscriptions.values()) {
          unsubscribe()
        }
        ws.close()
      }
      this.clients.clear()

      // Close the server
      this.server.close(() => {
        console.log('WebSocket server stopped')
        this.server = null
        resolve()
      })
    })
  }
}
