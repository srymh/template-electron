import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const webSearchToolDef = toolDefinition({
  name: 'webSearch',
  description: 'Perform a web search and return the results',
  inputSchema: z.object({
    query: z.string(),
    maxResults: z.int().min(1).max(10).optional(),
  }),
  outputSchema: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string(),
      content: z.string(),
      source: z.string(),
    }),
  ),
  needsApproval: true,
})

export const addKnowledgeToolDef = toolDefinition({
  name: 'addKnowledge',
  description:
    'Save user-provided content to persistent knowledge so the assistant can search and reference it in later responses. Use this when the user asks to add, save, store, remember, or put something into knowledge.',
  inputSchema: z.object({
    content: z.string(),
    docName: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    documentId: z.string().optional(),
    docName: z.string().optional(),
  }),
  needsApproval: true,
})

export const searchKnowledgeToolDef = toolDefinition({
  name: 'searchKnowledge',
  description:
    'Search persistent knowledge for information relevant to the current request. Use this when stored knowledge may contain project-specific, user-provided, or previously saved context.',
  inputSchema: z.object({
    query: z.string(),
    topK: z.number().int().min(1).max(20).optional(),
  }),
  outputSchema: z.array(
    z.object({
      content: z.string(),
      documentId: z.string(),
      docName: z.string(),
      score: z.number(),
    }),
  ),
})
