import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { retrieveRagContext } from '../../electron/shared/lib/rag/retrieve.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

async function main() {
  const question = 'なぜ春一番と呼ばれるのか？'
  const result = await retrieveRagContext(question, {
    dbPath: path.join(__dirname, 'example.json'),
    docName: 'example-doc',
    loadChunks: async (dbPath, docName) => {
      const data = await fs.readFile(dbPath, 'utf-8')
      return JSON.parse(data).filter((item: any) => item.docName === docName)
    },
    model: 'nomic-embed-text-v2-moe:latest',
    queryPrefix: 'search_query:',
    topK: 3,
  })
  const formattedResult = result
    .map((item) => `${item.content}\n【${item.score}】\n`)
    .join('')
  console.log(formattedResult)
}
