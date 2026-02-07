import * as React from 'react'

/**
 * useIframeMessage は iframe と postMessage でやり取りするための hook です。
 *
 * iframe が読み込まれた後に `sendToIframe` を使ってメッセージを送信できます。
 * また、iframe からメッセージを受信したい場合は `onMessage` コールバックを指定します。
 */
export function useIframeMessage<T>(
  onMessage?: (window: Window, data: T) => void,
): {
  sendToIframe: (data: T) => void
  ref: React.RefObject<HTMLIFrameElement | null>
} {
  const ref = React.useRef<HTMLIFrameElement | null>(null)

  const [sendToIframe, setSendToIframe] = React.useState<(data: T) => void>(
    () => () => {
      console.log('iframe is not ready yet')
    },
  )

  React.useEffect(() => {
    const iframe = ref.current
    if (!iframe) {
      return
    }

    const contentWindow = iframe.contentWindow
    if (!contentWindow) {
      return
    }

    const postMessage = (data: T) => {
      contentWindow.postMessage(
        {
          type: 'design',
          data,
        },
        '*',
      )
    }
    setSendToIframe(() => postMessage)

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type !== 'design') {
        return
      }
      onMessage?.(contentWindow, event.data.data)
    }
    contentWindow.addEventListener('message', handleMessage)
    return () => {
      contentWindow.removeEventListener('message', handleMessage)
    }
  }, [onMessage])

  return { ref, sendToIframe }
}
