import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { retrieveRagContext } from '../src/retrieve.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

async function main() {
  const question = '主要機能'
  const result = await retrieveRagContext(question, {
    dbPath: path.join(__dirname, '..', 'data', 'example.db'),
    model: 'nomic-embed-text-v2-moe:latest',
    queryPrefix: 'search_query:',
    topK: 3,
  })
  const formattedResult = result.map((item) => `${item.content}\n【${item.score}】\n`).join('')
  console.log(formattedResult)
}
