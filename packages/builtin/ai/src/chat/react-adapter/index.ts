import { stream } from '@tanstack/ai-client'

import { createAsyncQueue } from '@repo/async-queue'

import type { ChatRequest, ChatResponse } from '../types'

/**
 * 標準 stream adapter の AG-UI 要求と応答を IPC に接続する。
 * @param options - 要求の送信と、応答イベントの購読・解除を行う能力
 * @returns 会話 ID・実行 ID・Interrupt 再開情報を保持する接続
 */
export function aiChatAdapter({
  chat,
  addListener,
}: {
  chat: (args: ChatRequest & { id: string }) => Promise<void>
  addListener: (listener: (resp: ChatResponse) => void) => () => void
}) {
  return stream(async function* (_messages, _data, abortSignal, input) {
    if (abortSignal?.aborted) return
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
      ...input,
      id,
    }).catch((error) => {
      // 待機中の受信にも失敗を届けるため、配送イベントとして通知する。
      queue.push({
        type: 'error',
        id,
        error: error instanceof Error ? error.message : String(error),
      })
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
      queue.close()
    }
  })
}
