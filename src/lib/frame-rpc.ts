type AuthStatusRpcEnvelopeBase = {
  __authStatusRpc: 'v1'
  id: string
}

export type AuthStatusRpcRequest = AuthStatusRpcEnvelopeBase & {
  kind: 'request'
}

export type AuthStatusRpcResponse = AuthStatusRpcEnvelopeBase &
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

export function requestAuthStatusFromParent<T>(options?: {
  timeoutMs?: number
}): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 2000

  if (window.self === window.top) {
    return Promise.reject(
      new Error(
        '[auth-status-rpc] requestAuthStatusFromParent must be called from an iframe',
      ),
    )
  }

  const id = randomId()
  const message: AuthStatusRpcRequest = {
    __authStatusRpc: 'v1',
    kind: 'request',
    id,
  }

  const targetOrigin =
    window.location.origin === 'null' ? '*' : window.location.origin

  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error(`[auth-status-rpc] timeout (${timeoutMs}ms)`))
    }, timeoutMs)

    function onMessage(event: MessageEvent) {
      const data = event.data as unknown
      if (!isSameOrigin(event.origin)) return
      if (!data || typeof data !== 'object') return

      const maybe = data as Partial<AuthStatusRpcResponse>
      if (maybe.__authStatusRpc !== 'v1') return
      if (maybe.kind !== 'response') return
      if (maybe.id !== id) return

      cleanup()

      if (maybe.ok === true) {
        resolve(
          (maybe as Extract<AuthStatusRpcResponse, { ok: true }>).result as T,
        )
        return
      }

      if (maybe.ok === false) {
        reject(
          new Error(
            (maybe as Extract<AuthStatusRpcResponse, { ok: false }>).error,
          ),
        )
        return
      }

      reject(new Error('[auth-status-rpc] invalid response'))
    }

    function cleanup() {
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
    }

    window.addEventListener('message', onMessage)

    try {
      window.parent.postMessage(message, targetOrigin)
    } catch (e) {
      cleanup()
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

export function registerAuthStatusResponder(
  handler: () => unknown | Promise<unknown>,
): () => void {
  function onMessage(event: MessageEvent) {
    const data = event.data as unknown
    if (!isSameOrigin(event.origin)) return
    if (!data || typeof data !== 'object') return

    const maybe = data as Partial<AuthStatusRpcRequest>
    if (maybe.__authStatusRpc !== 'v1') return
    if (maybe.kind !== 'request') return
    if (typeof maybe.id !== 'string') return

    const requestId = maybe.id

    const reply = async () => {
      try {
        const result = await handler()
        const response: AuthStatusRpcResponse = {
          __authStatusRpc: 'v1',
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
        const response: AuthStatusRpcResponse = {
          __authStatusRpc: 'v1',
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
