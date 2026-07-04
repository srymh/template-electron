import type { ConnectionAdapter } from '@tanstack/ai-react'

import { createAsyncQueue } from '@repo/async-queue'

import type { ChatRequest, ChatResponse } from '../types'

/**
 * https://tanstack.com/ai/latest/docs/guides/connection-adapters#custom-adapters
 * @returns
 */
export function aiChatAdapter({
  chat,
  addListener,
}: {
  chat: (args: ChatRequest & { id: string }) => Promise<void>
  addListener: (listener: (resp: ChatResponse) => void) => () => void
}) {
  const connection: ConnectionAdapter = {
    async *connect(messages, data, abortSignal) {
      const id = crypto.randomUUID()
      const queue = createAsyncQueue<ChatResponse>()

      // IPC イベントリスナーを登録
      const removeListener = addListener((resp) => {
        // id が一致するものだけ処理する
        if (resp.id !== id) return
        // ここでは yield できないのでキューに追加する
        queue.push(resp)
      })

      // IPC 経由でチャットを開始
      // 次の for を実行したいので、ここでは await しない
      chat({
        messages,
        data,
        id,
      }).catch((error) => {
        queue.error(error)
      })

      let removeAbortListener: () => void = () => {}
      if (abortSignal) {
        const onAbort = () => queue.close()
        abortSignal.addEventListener('abort', onAbort, { once: true })
        removeAbortListener = () => abortSignal.removeEventListener('abort', onAbort)
      }

      try {
        for (;;) {
          const resp = await queue.shift()
          if (resp == null) {
            break
          } else if (resp.type === 'done') {
            break
          } else if (resp.type === 'error') {
            throw new Error(resp.error)
          } else {
            yield resp.chunk
          }
        }
      } catch (err) {
        console.error(`${new Date().toISOString()} Error in fetchIpcEvents connection:`, err)
        throw err
      } finally {
        removeListener()
        removeAbortListener()
      }
    },
  }

  return connection
}
