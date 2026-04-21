import { useLayoutEffect, useRef } from 'react'

type Options = {
  enabled?: boolean
  bottomThreshold?: number
  initialBehavior?: ScrollBehavior
  behavior?: ScrollBehavior
}

export function useAutoScrollToBottom(deps: ReadonlyArray<unknown>, options: Options = {}) {
  const {
    enabled = true,
    bottomThreshold = 48,
    initialBehavior = 'auto',
    behavior = 'smooth',
  } = options

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const scrollBottomRef = useRef<HTMLDivElement | null>(null)

  const isPinnedToBottomRef = useRef(true)
  const hasAutoScrolledOnceRef = useRef(false)

  useLayoutEffect(() => {
    if (!enabled) return
    if (!isPinnedToBottomRef.current) return

    const nextBehavior = hasAutoScrolledOnceRef.current ? behavior : initialBehavior

    hasAutoScrolledOnceRef.current = true

    requestAnimationFrame(() => {
      scrollBottomRef.current?.scrollIntoView({
        block: 'end',
        behavior: nextBehavior,
      })
    })
  }, deps)

  const onScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isPinnedToBottomRef.current = distanceFromBottom < bottomThreshold
  }

  return {
    scrollContainerRef,
    scrollBottomRef,
    onScroll,
  }
}
