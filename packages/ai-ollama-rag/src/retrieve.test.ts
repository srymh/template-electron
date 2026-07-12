import { describe, expect, it, vi } from 'vitest'
import ollama from 'ollama'

import { retrieveRagContext } from './retrieve'
import type { ChunkRow } from './retrieve'

vi.mock('ollama', () => {
  return {
    default: {
      embeddings: vi.fn(),
    },
  }
})

describe('retrieveRagContext', () => {
  it('searches across the corpus when no filter is provided', async () => {
    vi.mocked(ollama.embeddings).mockResolvedValue({ embedding: [1, 0] })

    const rows: Array<ChunkRow> = [
      {
        id: 1,
        documentId: 'doc-a',
        docName: 'Document A',
        sourceChunkIdx: 0,
        subIdx: 0,
        content: 'matching content',
        embedding: [1, 0],
      },
      {
        id: 2,
        documentId: 'doc-b',
        docName: 'Document B',
        sourceChunkIdx: 0,
        subIdx: 0,
        content: 'other content',
        embedding: [0, 1],
      },
    ]
    const loadChunks = vi.fn(async () => rows)

    const result = await retrieveRagContext('query', {
      dbPath: ':memory:',
      model: 'test-model',
      loadChunks,
      topK: 2,
    })

    expect(loadChunks).toHaveBeenCalledWith(':memory:', undefined)
    expect(result.map((item) => item.documentId)).toEqual(['doc-a', 'doc-b'])
  })
})
