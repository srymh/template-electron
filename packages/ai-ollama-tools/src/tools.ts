import { ingestDocuments, retrieveRagContext } from '@repo/rag'

import { webSearchToolDef, addKnowledgeToolDef, searchKnowledgeToolDef } from './definition'
import { createWebSearch } from './web-search'

export const createWebSearchTool = (apiKey?: string | (() => Promise<string | undefined>)) =>
  webSearchToolDef.server(async (args) => {
    const { query, maxResults } = args
    const webSearch = createWebSearch(apiKey)
    const results = await webSearch({ query, maxResults })
    return results
  })

export const createAddKnowledgeTool = (
  options: (
    | {
        dbPath: string
      }
    | {
        getDbPath: () => Promise<string> | string
      }
  ) & {
    onProgress?: (progress: number, total: number) => void
  },
) =>
  addKnowledgeToolDef.server(async (args) => {
    const { onProgress } = options
    const { content, docName } = args

    try {
      const dbPath = 'dbPath' in options ? options.dbPath : await options.getDbPath()
      const result = await ingestDocuments(content, {
        dbPath,
        docName,
        model: 'nomic-embed-text-v2-moe:latest',
        prefix: 'search_document:',
        chunkSize: 900,
        overlap: 120,
        maxEmbeddingChars: 700,
        embeddingOverlap: 120,
        onProgress,
      })
      return {
        success: true,
        message: 'Knowledge saved successfully',
        documentId: result.documentId,
        docName: result.docName,
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to save knowledge: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  })

export const createSearchKnowledgeTool = (
  options:
    | {
        dbPath: string
      }
    | {
        getDbPath: () => Promise<string> | string
      },
) =>
  searchKnowledgeToolDef.server(async (args) => {
    const dbPath = 'dbPath' in options ? options.dbPath : await options.getDbPath()
    const { query, topK } = args

    const result = await retrieveRagContext(query, {
      dbPath,
      model: 'nomic-embed-text-v2-moe:latest',
      queryPrefix: 'search_query:',
      topK,
    })

    return result.map((item) => ({
      content: item.content,
      documentId: item.documentId,
      docName: item.docName,
      score: item.score,
    }))
  })
