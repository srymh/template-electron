import * as React from 'react'

type IframeMessageEnvelope<TData> = {
  type: string
  data?: TData
}

type ParentWindowMessageOptions<TData> = {
  type: string
  onMessage: (data: TData | undefined, event: MessageEvent) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  return true
}

function getMessageEnvelope<TData>(
  value: unknown,
  type: string,
): IframeMessageEnvelope<TData> | null {
  if (!isRecord(value)) return null

  const maybe = value as Partial<IframeMessageEnvelope<TData>>
  return maybe.type === type ? (maybe as IframeMessageEnvelope<TData>) : null
}

function isSameOrigin(eventOrigin: string): boolean {
  const currentOrigin = window.location.origin
  if (currentOrigin === 'null') {
    return eventOrigin === 'null' || eventOrigin.startsWith('file://')
  }
  return eventOrigin === currentOrigin
}

function getTargetOrigin(): string {
  return window.location.origin === 'null' ? '*' : window.location.origin
}

function getParentWindow(): Window | null {
  try {
    return window.self === window.top ? null : window.parent
  } catch {
    return window.parent
  }
}

/**
 * iframe が読み込まれた後に `sendToIframe` で typed envelope を送信します。
 */
export function useIframeMessage<TData>(type: string): {
  sendToIframe: (data: TData) => void
  handleLoad: () => void
  isReady: boolean
  ref: React.RefObject<HTMLIFrameElement | null>
} {
  const ref = React.useRef<HTMLIFrameElement | null>(null)
  const [isReady, setIsReady] = React.useState(false)

  const sendToIframe = React.useCallback(
    (data: TData) => {
      const contentWindow = ref.current?.contentWindow
      if (!contentWindow) return

      contentWindow.postMessage(
        {
          type,
          data,
        },
        getTargetOrigin(),
      )
    },
    [type],
  )

  const handleLoad = React.useCallback(() => {
    setIsReady(true)
  }, [])

  return { ref, sendToIframe, handleLoad, isReady }
}

export function useParentWindowMessage<TData>({
  type,
  onMessage,
}: ParentWindowMessageOptions<TData>) {
  const onMessageRef = React.useRef(onMessage)

  React.useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  React.useEffect(() => {
    const parentWindow = getParentWindow()
    if (!parentWindow) return

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== parentWindow) return
      if (!isSameOrigin(event.origin)) return

      const message = getMessageEnvelope<TData>(event.data, type)
      if (!message) return

      onMessageRef.current(message.data, event)
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [type])
}
