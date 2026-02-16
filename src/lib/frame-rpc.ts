type FrameRpcEnvelopeBase = {
  __frameRpc: 'v1'
  id: string
}

export type FrameRpcRequest = FrameRpcEnvelopeBase & {
  kind: 'request'
  method: string
  params?: unknown
}

export type FrameRpcResponse = FrameRpcEnvelopeBase &
  (
    | {
        kind: 'response'
        ok: true
        result: unknown
      }
    | {
        kind: 'response'
        ok: false
        error: string
      }
  )

type FrameRpcHandler = (
  params: unknown,
  event: MessageEvent,
) => unknown | Promise<unknown>

function isSameOrigin(eventOrigin: string): boolean {
  const currentOrigin = window.location.origin
  if (currentOrigin === 'null') {
    // file:// は opaque origin になりやすく、event.origin は 'null' になることが多い。
    // 環境差で 'file://' 等になる可能性もあるため、ここは緩めに許可する。
    return eventOrigin === 'null' || eventOrigin.startsWith('file://')
  }
  return eventOrigin === currentOrigin
}

function randomId(): string {
  try {
    // Prefer crypto for uniqueness
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export function requestToParent<T>(
  method: string,
  params?: unknown,
  options?: { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 2000

  if (window.self === window.top) {
    return Promise.reject(
      new Error('[frame-rpc] requestToParent must be called from an iframe'),
    )
  }

  const id = randomId()
  const message: FrameRpcRequest = {
    __frameRpc: 'v1',
    kind: 'request',
    id,
    method,
    params,
  }

  const targetOrigin =
    window.location.origin === 'null' ? '*' : window.location.origin

  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error(`[frame-rpc] timeout (${timeoutMs}ms): ${method}`))
    }, timeoutMs)

    function onMessage(event: MessageEvent) {
      const data = event.data as unknown
      if (!isSameOrigin(event.origin)) return
      if (!data || typeof data !== 'object') return

      const maybe = data as Partial<FrameRpcResponse>
      if (maybe.__frameRpc !== 'v1') return
      if (maybe.kind !== 'response') return
      if (maybe.id !== id) return

      cleanup()

      if (maybe.ok === true) {
        resolve((maybe as Extract<FrameRpcResponse, { ok: true }>).result as T)
        return
      }

      if (maybe.ok === false) {
        reject(
          new Error((maybe as Extract<FrameRpcResponse, { ok: false }>).error),
        )
        return
      }

      reject(new Error('[frame-rpc] invalid response'))
    }

    function cleanup() {
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
    }

    window.addEventListener('message', onMessage)

    // If posting fails, treat as immediate failure
    try {
      window.parent.postMessage(message, targetOrigin)
    } catch (e) {
      cleanup()
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

export function registerFrameRpcHandlers(
  handlers: Partial<Record<string, FrameRpcHandler>>,
): () => void {
  function onMessage(event: MessageEvent) {
    const data = event.data as unknown
    if (!isSameOrigin(event.origin)) return
    if (!data || typeof data !== 'object') return

    const maybe = data as Partial<FrameRpcRequest>
    if (maybe.__frameRpc !== 'v1') return
    if (maybe.kind !== 'request') return
    if (typeof maybe.id !== 'string') return
    if (typeof maybe.method !== 'string') return

    const requestId = maybe.id
    const method = maybe.method

    const handler = handlers[method]
    if (!handler) return

    const reply = async () => {
      try {
        const result = await handler(maybe.params, event)
        const response: FrameRpcResponse = {
          __frameRpc: 'v1',
          kind: 'response',
          id: requestId,
          ok: true,
          result,
        }
        const sourceWindow = event.source as WindowProxy | null
        sourceWindow?.postMessage(
          response,
          window.location.origin === 'null' ? '*' : window.location.origin,
        )
      } catch (e) {
        const response: FrameRpcResponse = {
          __frameRpc: 'v1',
          kind: 'response',
          id: requestId,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }
        const sourceWindow = event.source as WindowProxy | null
        sourceWindow?.postMessage(
          response,
          window.location.origin === 'null' ? '*' : window.location.origin,
        )
      }
    }

    void reply()
  }

  window.addEventListener('message', onMessage)
  return () => {
    window.removeEventListener('message', onMessage)
  }
}
