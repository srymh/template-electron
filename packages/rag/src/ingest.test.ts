import { describe, expect, it, vi } from 'vitest'
import ollama from 'ollama'

import { ingestDocuments } from './ingest'

vi.mock('ollama', () => {
  return {
    default: {
      embeddings: vi.fn(),
    },
  }
})

describe('ingestDocuments', () => {
  it('adds a document with documentId and append mode by default', async () => {
    vi.mocked(ollama.embeddings).mockResolvedValue({ embedding: [0.1, 0.2, 0.3] })

    const initialize = vi.fn()
    const insert = vi.fn()
    const finalize = vi.fn()
    const createHandlers = vi.fn(async () => ({
      initialize,
      insert,
      finalize,
    }))

    const result = await ingestDocuments('new corpus document', {
      dbPath: ':memory:',
      documentId: 'doc-1',
      docName: 'Document 1',
      model: 'test-model',
      createHandlers,
    })

    expect(createHandlers).toHaveBeenCalledWith(':memory:', 'doc-1', { mode: 'append' })
    expect(insert).toHaveBeenCalledWith(
      'doc-1',
      'Document 1',
      0,
      0,
      'new corpus document',
      JSON.stringify([0.1, 0.2, 0.3]),
    )
    expect(result).toEqual({
      documentId: 'doc-1',
      docName: 'Document 1',
      chunkCount: 1,
    })
  })

  it('finalizes handlers when insert fails after initialization', async () => {
    const calls: Array<string> = []

    vi.mocked(ollama.embeddings).mockResolvedValue({ embedding: [0.1, 0.2, 0.3] })

    const initialize = vi.fn(async () => {
      calls.push('initialize')
    })
    const insert = vi.fn(async () => {
      calls.push('insert')
      throw new Error('insert failed')
    })
    const finalize = vi.fn(async () => {
      calls.push('finalize')
    })

    await expect(
      ingestDocuments('handler cleanup check', {
        dbPath: ':memory:',
        docName: 'doc',
        model: 'test-model',
        createHandlers: async () => ({
          initialize,
          insert,
          finalize,
        }),
      }),
    ).rejects.toThrow('insert failed')

    expect(initialize).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledTimes(1)
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['initialize', 'insert', 'finalize'])
  })
})
