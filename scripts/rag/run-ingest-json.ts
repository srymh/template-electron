import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ingestDocuments } from '../../electron/shared/lib/rag/ingest.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

async function main() {
  const textPath = path.join(__dirname, 'example.txt')
  const text = await fs.readFile(textPath, 'utf-8')
  await ingestDocuments(text, {
    dbPath: path.join(__dirname, '..', '..', 'data', 'example.json'),
    docName: 'example-doc',
    createHandlers: (dbPath) => {
      type ChunkEntry = {
        docName: string
        sourceChunkIndex: number
        subIndex: number
        content: string
        embedding: Array<number>
      }
      const data: Array<ChunkEntry> = []
      return {
        initialize: () => {},
        insert: (docName, sourceChunkIndex, subIndex, content, embeddingJson) => {
          data.push({
            docName,
            sourceChunkIndex,
            subIndex,
            content,
            embedding: JSON.parse(embeddingJson),
          })
        },
        finalize: async () => {
          await fs.writeFile(dbPath, JSON.stringify(data), 'utf-8')
        },
      }
    },
    model: 'nomic-embed-text-v2-moe:latest',
    prefix: 'search_document:',
    chunkSize: 900,
    overlap: 120,
    maxEmbeddingChars: 700,
    embeddingOverlap: 120,
  })
}
