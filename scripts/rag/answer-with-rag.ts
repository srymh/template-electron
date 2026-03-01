import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ollama from 'ollama'
import { retrieveRagContext } from '../../electron/shared/lib/rag/retrieve.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

async function main() {
  const question = 'このプロジェクトの主要機能は何ですか？'
  const result = await retrieveRagContext(question, {
    dbPath: path.join(__dirname, '..', '..', 'data', 'example.db'),
    docName: 'example-doc',
    model: 'nomic-embed-text-v2-moe:latest',
    queryPrefix: 'search_query:',
    topK: 3,
  })
  const context = result
    .map((item) => `${item.content}\n【${item.score}】\n`)
    .join('')

  const res = await ollama.chat({
    model: 'gpt-oss:20b-cloud',
    messages: [
      {
        role: 'system',
        content:
          'あなたは参考文（RAGコンテキスト）を基づいて回答します。参考文に根拠がない推測は控え、必要なら「参考文に記載なし」と述べてください。',
      },
      {
        role: 'user',
        content: `質問:\n${question}\n\n参考文:\n${context}`,
      },
    ],
    stream: false,
  })

  console.log('回答:\n', res.message.content)
}
