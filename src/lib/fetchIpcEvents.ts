import { convertMessagesToModelMessages } from '@tanstack/ai'
import type { ConnectionAdapter } from '@tanstack/ai-react'
import type { StreamChunk } from '@tanstack/ai'

import type { ElectronApi } from '@/electronApi'
import { electronApi } from '@/electronApi'

export const fetchIpcEvents = fetchIpcEvents_0

// -----------------------------------------------------------------------------
// export type AiChatApi = AiChatApi_0

function fetchIpcEvents_0() {
  const connection: ConnectionAdapter = {
    async *connect(messages, data, abortSignal) {
      const modelMessages = convertMessagesToModelMessages(messages)

      type Chunk = Parameters<
        Parameters<ElectronApi['aiChat']['on']['chunk']>[0]
      >[0]['chunk']
      const queue = createAsyncQueue<Chunk>()

      // IPC イベントリスナーを登録
      const removeListener = electronApi.aiChat.on.chunk(({ chunk }) => {
        queue.push(chunk)
      })

      // IPC 経由でチャットを開始
      // 次の for await を実行したいので、ここでは await しない
      electronApi.aiChat
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
          yield chunk as StreamChunk
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

// -----------------------------------------------------------------------------
// export type AiChatApi = AiChatApi_1

// function fetchIpcEvents_1() {
//   const connection: ConnectionAdapter = {
//     async *connect(messages, data, abortSignal) {
//       const modelMessages = convertMessagesToModelMessages(messages)
//       const readableStream = createReadableStream()
//       const reader = readableStream.getReader()

//       // IPC イベントリスナーを登録
//       const removeListener = electronApi.aiChat.on.chunk(({ chunk }) => {
//         // ここでは yield できないので、一旦 ReadableStream に enqueue する
//         if (chunk.type === 'done') {
//           readableStream.enqueue(new TextEncoder().encode('data: [DONE]'))
//           readableStream.close()
//         } else if (chunk.type === 'thinking') {
//           readableStream.enqueue(
//             new TextEncoder().encode('data: ' + JSON.stringify(chunk) + '\n\n'),
//           )
//         } else if (chunk.type === 'content') {
//           readableStream.enqueue(
//             new TextEncoder().encode('data: ' + JSON.stringify(chunk) + '\n\n'),
//           )
//         } else {
//           readableStream.enqueue(new TextEncoder().encode('data: [DONE]'))
//           readableStream.close()
//         }
//       })

//       // IPC 経由でチャットを開始
//       // 次の for await を実行したいので、ここでは await しない
//       electronApi.aiChat
//         .chat({
//           messages: modelMessages,
//           data,
//         })
//         .catch((error) => {
//           readableStream.error(error)
//         })

//       // ReadableStream から行単位で読み取り、yield する
//       for await (const line of readStreamLines(reader, abortSignal)) {
//         const d = line.startsWith('data: ') ? line.slice(6) : line

//         if (d === '[DONE]') continue

//         try {
//           const parsed: StreamChunk = JSON.parse(d)
//           yield parsed
//         } catch (parseError) {
//           // Skip non-JSON lines or malformed chunks
//           console.warn('Failed to parse chunk:', d, parseError)
//         }
//       }

//       removeListener()
//     },
//   }

//   return connection
// }

// // ReadableStream を作成するユーティリティ関数
// const createReadableStream = () => {
//   let controller: ReadableStreamDefaultController<Uint8Array>
//   const stream = new ReadableStream<Uint8Array>({
//     start: (ctrl) => {
//       controller = ctrl
//     },
//   })
//   const readableStream = {
//     getReader(): ReadableStreamDefaultReader<Uint8Array> {
//       return stream.getReader()
//     },
//     enqueue(chunk: Uint8Array): void {
//       controller.enqueue(chunk)
//     },
//     close(): void {
//       controller.close()
//     },
//     error(err: unknown): void {
//       controller.error(err)
//     },
//   }
//   return readableStream
// }

// /**
//  * Read lines from a stream (newline-delimited)
//  * https://github.com/TanStack/ai/blob/0e37d8b0c0a067cf66485f22440d94478075a15a/packages/typescript/ai-client/src/connection-adapters.ts#L26
//  */
// async function* readStreamLines(
//   reader: ReadableStreamDefaultReader<Uint8Array>,
//   abortSignal?: AbortSignal,
// ): AsyncGenerator<string> {
//   try {
//     const decoder = new TextDecoder()
//     let buffer = ''

//     // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
//     while (true) {
//       // Check if aborted before reading
//       if (abortSignal?.aborted) {
//         break
//       }

//       const { done, value } = await reader.read()
//       if (done) break

//       buffer += decoder.decode(value, { stream: true })
//       const lines = buffer.split('\n')

//       // Keep the last incomplete line in the buffer
//       buffer = lines.pop() || ''

//       for (const line of lines) {
//         if (line.trim()) {
//           yield line
//         }
//       }
//     }

//     // Process any remaining data in the buffer
//     if (buffer.trim()) {
//       yield buffer
//     }
//   } finally {
//     reader.releaseLock()
//   }
// }

// -----------------------------------------------------------------------------
// export type AiChatApi = AiChatApi_2

// function fetchIpcEvents_2() {
//   const connection: ConnectionAdapter = {
//     async *connect(messages, data, abortSignal) {
//       const modelMessages = convertMessagesToModelMessages(messages)

//       const queue = createAsyncQueue<string>()

//       // IPC イベントリスナーを登録
//       const removeListener = electronApi.aiChat.on.chunk(({ chunk }) => {
//         queue.push(chunk)
//       })

//       // IPC 経由でチャットを開始
//       // 次の for await を実行したいので、ここでは await しない
//       electronApi.aiChat
//         .chat({
//           messages: modelMessages,
//           data,
//         })
//         .catch((error) => {
//           queue.error(error)
//         })

//       let removeAbortListener: () => void = () => {}
//       if (abortSignal) {
//         const onAbort = () => queue.close()
//         abortSignal.addEventListener('abort', onAbort, { once: true })
//         removeAbortListener = () =>
//           abortSignal.removeEventListener('abort', onAbort)
//       }

//       try {
//         for (;;) {
//           const chunk = await queue.shift()
//           if (chunk == null) break

//           const line = chunk.trim()
//           if (!line) break

//           const d = line.startsWith('data: ') ? line.slice(6) : line

//           if (d === '[DONE]') break

//           try {
//             const parsed: StreamChunk = JSON.parse(d)
//             yield parsed
//           } catch (parseError) {
//             // Skip non-JSON lines or malformed chunks
//             console.warn('Failed to parse chunk:', d, parseError)
//           }
//         }
//       } finally {
//         removeListener()
//         removeAbortListener()
//       }
//     },
//   }

//   return connection
// }

// type AsyncQueue<T> = {
//   push: (value: T) => void
//   close: () => void
//   error: (err: unknown) => void
//   shift: () => Promise<T | undefined> // undefined = closed & drained
// }

// function createAsyncQueue<T>(): AsyncQueue<T> {
//   const values: Array<T> = []
//   const waiters: Array<(v: T | undefined) => void> = []
//   let closed = false
//   let failure: unknown | undefined

//   const push = (value: T) => {
//     if (closed) return
//     const w = waiters.shift()
//     if (w) w(value)
//     else values.push(value)
//   }

//   const close = () => {
//     if (closed) return
//     closed = true
//     while (waiters.length) waiters.shift()?.(undefined)
//   }

//   const error = (err: unknown) => {
//     failure = err
//     close()
//   }

//   const shift = async (): Promise<T | undefined> => {
//     if (failure) throw failure
//     const v = values.shift()
//     if (v !== undefined) return v
//     if (closed) return undefined
//     return await new Promise<T | undefined>((resolve) => {
//       waiters.push(resolve)
//     })
//   }

//   return { push, close, error, shift }
// }
