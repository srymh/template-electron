import { webSearchToolDef } from './definition'
import { createWebSearch } from './web-search'

export const createWebSearchTool = (apiKey?: string | (() => Promise<string | undefined>)) =>
  webSearchToolDef.server(async (args) => {
    const { query, maxResults } = args
    const webSearch = createWebSearch(apiKey)
    const results = await webSearch({ query, maxResults })
    return results
  })
