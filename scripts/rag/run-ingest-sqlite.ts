import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { ingestDocuments } from '../../electron/shared/lib/rag/ingest.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

async function main() {
  const textPath = path.join(__dirname, 'example-text.txt')
  const text = await fs.readFile(textPath, 'utf-8')
  await ingestDocuments(text, {
    dbPath: path.join(__dirname, 'example.db'),
    docName: 'example-doc',
    model: 'nomic-embed-text-v2-moe:latest',
    prefix: 'search_document:',
    chunkSize: 900,
    overlap: 120,
    maxEmbeddingChars: 700,
    embeddingOverlap: 120,
  })
}
