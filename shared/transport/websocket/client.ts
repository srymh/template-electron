/**
 * WebSocket Transport for RPC
 *
 * Client-side WebSocket transport implementation
 */

import type { EventDataMessage, InvokeErrorMessage, InvokeResponseMessage, RpcMessage, RpcTransport } from '../types'

/**
 * Client-side WebSocket transport
 */
export class WebSocketTransport implements RpcTransport {
  private ws: WebSocket | null = null
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
  }>()
  private eventListeners = new Map<string, Set<(data: any) => void>>()
  private messageId = 0
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(private url: string) {}

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(new Error('WebSocket connection failed'))
        }

        this.ws.onclose = () => {
          console.log('WebSocket closed')
          this.handleClose()
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message: RpcMessage = JSON.parse(data)

      switch (message.type) {
        case 'invoke-response':
          this.handleInvokeResponse(message)
          break
        case 'event-data':
          this.handleEventData(message)
          break
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  /**
   * Handle invoke response
   */
  private handleInvokeResponse(message: InvokeResponseMessage | InvokeErrorMessage): void {
    const pending = this.pendingRequests.get(message.id)
    if (!pending) return

    this.pendingRequests.delete(message.id)

    if (message.success) {
      pending.resolve(message.result)
    } else {
      const error = new Error(message.error.message)
      error.stack = message.error.stack
      pending.reject(error)
    }
  }

  /**
   * Handle event data
   */
  private handleEventData(message: EventDataMessage): void {
    const listeners = this.eventListeners.get(message.channel)
    if (!listeners) return

    for (const listener of listeners) {
      try {
        listener(message.data)
      } catch (error) {
        console.error(`Error in event listener for ${message.channel}:`, error)
      }
    }
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(): void {
    // Reject all pending requests
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error('WebSocket connection closed'))
    }
    this.pendingRequests.clear()

    // Attempt to reconnect with exponential backoff
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      
      // Exponential backoff with jitter to avoid thundering herd
      const backoff = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      const jitter = Math.random() * 1000
      const delay = backoff + jitter
      
      setTimeout(() => {
        this.connect().catch(console.error)
      }, delay)
    }
  }

  /**
   * Generate a unique message ID
   */
  private generateId(): string {
    return `${Date.now()}-${++this.messageId}`
  }

  /**
   * Send a message through WebSocket
   */
  private send(message: RpcMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }
    this.ws.send(JSON.stringify(message))
  }

  /**
   * Invoke a method
   */
  async invoke(channel: string, ...args: Array<any>): Promise<any> {
    const id = this.generateId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })

      try {
        this.send({
          type: 'invoke-request',
          id,
          channel,
          args,
        })
      } catch (error) {
        this.pendingRequests.delete(id)
        reject(error)
      }
    })
  }

  /**
   * Subscribe to events
   */
  subscribe(channel: string, listener: (data: any) => void): () => void {
    // Add listener
    if (!this.eventListeners.has(channel)) {
      this.eventListeners.set(channel, new Set())
    }
    this.eventListeners.get(channel)!.add(listener)

    // Send subscription request
    const id = this.generateId()
    try {
      this.send({
        type: 'event-subscribe',
        id,
        channel,
      })
    } catch (error) {
      console.error(`Failed to subscribe to ${channel}:`, error)
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(channel)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          this.eventListeners.delete(channel)
          // Send unsubscription request
          const unsubId = this.generateId()
          try {
            this.send({
              type: 'event-unsubscribe',
              id: unsubId,
              channel,
            })
          } catch (error) {
            console.error(`Failed to unsubscribe from ${channel}:`, error)
          }
        }
      }
    }
  }

  /**
   * Close the transport
   */
  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.pendingRequests.clear()
    this.eventListeners.clear()
  }
}
