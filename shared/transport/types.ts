/**
 * Transport-agnostic RPC protocol types
 *
 * This module defines the core message protocol for type-safe RPC
 * that can work over different transports (IPC, HTTP, WebSocket, etc.)
 */

/**
 * Message types for RPC communication
 */
export type MessageType = 'invoke-request' | 'invoke-response' | 'event-subscribe' | 'event-unsubscribe' | 'event-data'

/**
 * Base message structure with correlation ID
 */
export interface BaseMessage {
  type: MessageType
  id: string // Correlation ID for request/response matching
}

/**
 * Invoke request message
 */
export interface InvokeRequestMessage extends BaseMessage {
  type: 'invoke-request'
  channel: string
  args: Array<any>
}

/**
 * Invoke response message (success)
 */
export interface InvokeResponseMessage extends BaseMessage {
  type: 'invoke-response'
  success: true
  result: any
}

/**
 * Invoke response message (error)
 */
export interface InvokeErrorMessage extends BaseMessage {
  type: 'invoke-response'
  success: false
  error: {
    message: string
    stack?: string
  }
}

/**
 * Event subscription request
 */
export interface EventSubscribeMessage extends BaseMessage {
  type: 'event-subscribe'
  channel: string
}

/**
 * Event unsubscription request
 */
export interface EventUnsubscribeMessage extends BaseMessage {
  type: 'event-unsubscribe'
  channel: string
}

/**
 * Event data message
 */
export interface EventDataMessage extends BaseMessage {
  type: 'event-data'
  channel: string
  data: any
}

/**
 * Union of all message types
 */
export type RpcMessage =
  | InvokeRequestMessage
  | InvokeResponseMessage
  | InvokeErrorMessage
  | EventSubscribeMessage
  | EventUnsubscribeMessage
  | EventDataMessage

/**
 * Transport interface for sending invoke requests
 */
export interface InvokeTransport {
  /**
   * Send an invoke request and wait for response
   * @param channel The channel/method name
   * @param args Arguments to pass
   * @returns Promise that resolves with the result
   */
  invoke: (channel: string, ...args: Array<any>) => Promise<any>
}

/**
 * Transport interface for event subscriptions
 */
export interface EventTransport {
  /**
   * Subscribe to events on a channel
   * @param channel The channel name
   * @param listener The event listener callback
   * @returns Function to unsubscribe
   */
  subscribe: (channel: string, listener: (data: any) => void) => () => void
}

/**
 * Complete transport interface combining invoke and event capabilities
 */
export interface RpcTransport extends InvokeTransport, EventTransport {
  /**
   * Close/cleanup the transport
   */
  close?: () => void
}

/**
 * Server-side transport handler interface
 */
export interface ServerTransport {
  /**
   * Register a handler for invoke requests
   * @param channel The channel/method name
   * @param handler The handler function
   */
  handleInvoke: (channel: string, handler: (...args: Array<any>) => Promise<any>) => void

  /**
   * Register a handler for event subscriptions
   * @param channel The channel name
   * @param onSubscribe Callback when a client subscribes
   * @param onUnsubscribe Callback when a client unsubscribes
   */
  handleEvent: (
    channel: string,
    onSubscribe: (sendData: (data: any) => void) => () => void
  ) => void

  /**
   * Start the server
   */
  start?: () => Promise<void>

  /**
   * Stop the server
   */
  stop?: () => Promise<void>
}
