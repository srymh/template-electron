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
