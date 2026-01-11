import { convertMessagesToModelMessages } from '@tanstack/ai'
import type { ConnectionAdapter } from '@tanstack/ai-react'
import type { StreamChunk } from '@tanstack/ai'

import { electronApi } from '@/electronApi'

export function fetchIpcEvents() {
  // ReadableStream を作成するユーティリティ関数
  const createReadableStream = () => {
    let controller: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start: (ctrl) => {
        controller = ctrl
      },
    })
    const readableStream = {
      getReader(): ReadableStreamDefaultReader<Uint8Array> {
        return stream.getReader()
      },
      enqueue(chunk: Uint8Array): void {
        controller.enqueue(chunk)
      },
      close(): void {
        controller.close()
      },
      error(err: unknown): void {
        controller.error(err)
      },
    }
    return readableStream
  }

  const connection: ConnectionAdapter = {
    async *connect(messages, data, abortSignal) {
      const modelMessages = convertMessagesToModelMessages(messages)
      const readableStream = createReadableStream()
      const reader = readableStream.getReader()

      // IPC イベントリスナーを登録
      const removeListener = electronApi.aiChat.on.chunk(({ chunk }) => {
        // ここでは yield できないので、一旦 ReadableStream に enqueue する
        if (chunk.type === 'done') {
          readableStream.enqueue(new TextEncoder().encode('data: [DONE]'))
          readableStream.close()
        } else if (chunk.type === 'thinking') {
          readableStream.enqueue(
            new TextEncoder().encode('data: ' + JSON.stringify(chunk) + '\n\n'),
          )
        } else if (chunk.type === 'content') {
          readableStream.enqueue(
            new TextEncoder().encode('data: ' + JSON.stringify(chunk) + '\n\n'),
          )
        } else {
          readableStream.enqueue(new TextEncoder().encode('data: [DONE]'))
          readableStream.close()
        }
      })

      // IPC 経由でチャットを開始
      // 次の for await を実行したいので、ここでは await しない
      electronApi.aiChat
        .chat({
          messages: modelMessages,
          data,
        })
        .catch((error) => {
          readableStream.error(error)
        })

      // ReadableStream から行単位で読み取り、yield する
      for await (const line of readStreamLines(reader, abortSignal)) {
        const d = line.startsWith('data: ') ? line.slice(6) : line

        if (d === '[DONE]') continue

        try {
          const parsed: StreamChunk = JSON.parse(d)
          yield parsed
        } catch (parseError) {
          // Skip non-JSON lines or malformed chunks
          console.warn('Failed to parse chunk:', d, parseError)
        }
      }

      removeListener()
    },
  }

  return connection
}

/**
 * Read lines from a stream (newline-delimited)
 * https://github.com/TanStack/ai/blob/0e37d8b0c0a067cf66485f22440d94478075a15a/packages/typescript/ai-client/src/connection-adapters.ts#L26
 */
async function* readStreamLines(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  abortSignal?: AbortSignal,
): AsyncGenerator<string> {
  try {
    const decoder = new TextDecoder()
    let buffer = ''

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      // Check if aborted before reading
      if (abortSignal?.aborted) {
        break
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim()) {
          yield line
        }
      }
    }

    // Process any remaining data in the buffer
    if (buffer.trim()) {
      yield buffer
    }
  } finally {
    reader.releaseLock()
  }
}
