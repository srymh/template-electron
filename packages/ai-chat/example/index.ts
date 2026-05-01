import { chat } from '../dist/index.mjs'

// pnpm run example -- "こんにちは、元気ですか？"
const inputMessage = process.argv.slice(2).join(' ') || 'Hello, how are you?'

// export AI_CHAT_EXAMPLE_MODEL=qwen3.5:9b && pnpm run example -- "こんにちは、元気ですか？"
// 例: 'gpt-oss:20b', 'qwen3.5:9b'
const model = process.env['AI_CHAT_EXAMPLE_MODEL'] ?? 'gpt-oss:20b'

let count = 0
const message = inputMessage

;(async () => {
  try {
    await chat({
      request: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                content: message,
              },
            ],
          },
        ],
        data: { model },
      },
      onChunk: (chunk) => {
        switch (chunk.type) {
          case 'TEXT_MESSAGE_CONTENT':
            console.log(count.toString().padStart(3, ' ') + ':', chunk.content)
            count++
            break
          default:
            if ('content' in chunk) {
              const content = (chunk.content ?? '').replace(/\n/g, '↩')
              console.log('___:', content.length > 100 ? content.slice(0, 100) + '...' : content)
            } else {
              console.log('___:', `[${chunk.type}]`)
            }
            break
        }
      },
      onDone: () => {
        console.log('Chat completed')
      },
      onError: (error) => {
        console.error('Chat error:', error)
      },
    })
  } catch (error) {
    console.error('Error in chat:', error)
  }
})()
