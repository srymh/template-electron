/**
 * IPC Transport Adapter for Electron
 *
 * Wraps Electron IPC to conform to the RpcTransport interface
 */

import { ipcRenderer } from 'electron'
import type { RpcTransport } from '../types'

/**
 * Client-side IPC transport using Electron's ipcRenderer
 */
export class IpcTransport implements RpcTransport {
  private eventListeners = new Map<string, Map<(data: any) => void, any>>()

  /**
   * Invoke a method on the main process
   */
  async invoke(channel: string, ...args: Array<any>): Promise<any> {
    return ipcRenderer.invoke(channel, ...args)
  }

  /**
   * Subscribe to events from the main process
   */
  subscribe(channel: string, listener: (data: any) => void): () => void {
    const responseChannel = `${channel}::response`

    // Create wrapper to unwrap IPC event format
    const listenerWrapper = (_: Electron.IpcRendererEvent, ...args: Array<any>) => {
      // Convention: only args[0] is passed to listener
      listener(args[0])
    }

    // Store the wrapper for cleanup
    if (!this.eventListeners.has(channel)) {
      this.eventListeners.set(channel, new Map())
    }
    this.eventListeners.get(channel)!.set(listener, listenerWrapper)

    // Register listener first to avoid missing events
    ipcRenderer.on(responseChannel, listenerWrapper)

    // Flag to prevent double removal
    let disposed = false

    // Unsubscribe function
    const unsubscribe = () => {
      if (disposed) return
      disposed = true

      // Remove from map
      const listeners = this.eventListeners.get(channel)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          this.eventListeners.delete(channel)
        }
      }

      // Remove IPC listener
      ipcRenderer.off(responseChannel, listenerWrapper)

      // Notify main process to unsubscribe
      ipcRenderer
        .invoke(channel, false)
        .catch((error) =>
          console.error(`Failed to unsubscribe from ${channel}:`, error)
        )
    }

    // Notify main process to subscribe
    ipcRenderer
      .invoke(channel, true)
      .catch((error) => {
        console.error(`Failed to subscribe to ${channel}:`, error)
        // Rollback on failure
        unsubscribe()
      })

    return unsubscribe
  }

  /**
   * Close the transport and cleanup
   */
  close(): void {
    // Remove all event listeners
    for (const [channel, listeners] of this.eventListeners.entries()) {
      const responseChannel = `${channel}::response`
      for (const wrapper of listeners.values()) {
        ipcRenderer.off(responseChannel, wrapper)
      }
    }
    this.eventListeners.clear()
  }
}
