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
