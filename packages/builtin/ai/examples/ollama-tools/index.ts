import { createWebSearchTool } from '../../dist/ollama/tools/index.mjs'

const query = process.argv[2] ?? ''

if (query.trim().length === 0) {
  console.log('Query is required')
  console.log('Example: pnpm run example:web-search hello')
  process.exit(0)
}

console.log(`Searching for: ${query}`)

const webSearch = createWebSearchTool().execute

if (!webSearch) {
  console.log('webSearch is not available')
  process.exit(0)
}

const result = await webSearch({ query, maxResults: 1 })
console.log(result)
