import { convertMessagesToModelMessages } from '@tanstack/ai'
import type { ConnectionAdapter } from '@tanstack/ai-react'
import type { StreamChunk } from '@tanstack/ai'

import { api } from '@/api'

/**
 * https://tanstack.com/ai/latest/docs/guides/connection-adapters#custom-adapters
 * @returns
 */
export function fetchIpcEvents() {
  const connection: ConnectionAdapter = {
    async *connect(messages, data, abortSignal) {
      const modelMessages = convertMessagesToModelMessages(messages)
      const queue = createAsyncQueue<StreamChunk>()

      // IPC イベントリスナーを登録
      const removeListener = api.aiChat.on.chunk(({ chunk }) => {
        // ここでは yield できないのでキューに追加する
        queue.push(chunk)
      })

      // IPC 経由でチャットを開始
      // 次の for を実行したいので、ここでは await しない
      api.aiChat
        .chat({
          messages: modelMessages,
          data,
        })
        .catch((error) => {
          queue.error(error)
        })

      let removeAbortListener: () => void = () => {}
      if (abortSignal) {
        const onAbort = () => queue.close()
        abortSignal.addEventListener('abort', onAbort, { once: true })
        removeAbortListener = () =>
          abortSignal.removeEventListener('abort', onAbort)
      }

      try {
        for (;;) {
          const chunk = await queue.shift()
          if (chunk == null) break
          if (chunk.type === 'done') break
          yield chunk
        }
      } finally {
        removeListener()
        removeAbortListener()
      }
    },
  }

  return connection
}

type AsyncQueue<T> = {
  push: (value: T) => void
  close: () => void
  error: (err: unknown) => void
  shift: () => Promise<T | undefined> // undefined = closed & drained
}

function createAsyncQueue<T>(): AsyncQueue<T> {
  const values: Array<T> = []
  const waiters: Array<(v: T | undefined) => void> = []
  let closed = false
  let failure: unknown | undefined

  const push = (value: T) => {
    if (closed) return
    const w = waiters.shift()
    if (w) w(value)
    else values.push(value)
  }

  const close = () => {
    if (closed) return
    closed = true
    while (waiters.length) waiters.shift()?.(undefined)
  }

  const error = (err: unknown) => {
    failure = err
    close()
  }

  const shift = async (): Promise<T | undefined> => {
    if (failure) throw failure
    const v = values.shift()
    if (v !== undefined) return v
    if (closed) return undefined
    return await new Promise<T | undefined>((resolve) => {
      waiters.push(resolve)
    })
  }

  return { push, close, error, shift }
}
