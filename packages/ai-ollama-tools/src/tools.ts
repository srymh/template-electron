import { webSearchToolDef } from './definition'
import { webSearch } from './web-search'

export const webSearchTool = webSearchToolDef.server(async (args) => {
  const { query, maxResults } = args
  const results = await webSearch({ query, maxResults })
  return results
})
