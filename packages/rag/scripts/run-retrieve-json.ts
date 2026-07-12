import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ChunkRow } from '../src/retrieve.ts'
import { retrieveRagContext } from '../src/retrieve.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

async function main() {
  const question = '主要機能'
  const result = await retrieveRagContext(question, {
    dbPath: path.join(__dirname, '..', 'data', 'example.json'),
    loadChunks: async (dbPath, filter) => {
      const data = await fs.readFile(dbPath, 'utf-8')
      const rows = JSON.parse(data) as Array<ChunkRow>
      if (!filter?.documentIds && !filter?.docNames) {
        return rows
      }
      return rows.filter((item) => {
        return (
          filter.documentIds?.includes(item.documentId) || filter.docNames?.includes(item.docName)
        )
      })
    },
    model: 'nomic-embed-text-v2-moe:latest',
    queryPrefix: 'search_query:',
    topK: 3,
  })
  const formattedResult = result.map((item) => `${item.content}\n【${item.score}】\n`).join('')
  console.log(formattedResult)
}
