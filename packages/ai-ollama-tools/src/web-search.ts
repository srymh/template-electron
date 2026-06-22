import { Ollama } from 'ollama'

export type WebSearchInput = {
  query: string
  maxResults?: number
  /** Ollama APIキー `OLLAMA_API_KEY` */
  apiKey?: string
}

export type WebSearchResult = {
  id: string
  title: string
  url: string
  content: string
  source: string
}

/**
 * Web検索を実行し、結果を返します。
 *
 * https://docs.ollama.com/capabilities/web-search
 *
 * @param input 検索クエリと最大結果数を指定します。
 * @returns 検索結果の配列を返します。
 */
export async function webSearch(input: WebSearchInput): Promise<WebSearchResult[]> {
  const { query, maxResults = 5, apiKey } = input

  const ollama = new Ollama({
    host: 'https://ollama.com',
    headers: { Authorization: 'Bearer ' + (apiKey ?? process.env.OLLAMA_API_KEY) },
  })

  const results = await ollama.webSearch({
    query,
    // @ts-expect-error ollama apiの型と実装が一致していない
    // https://github.com/ollama/ollama-js/issues/283
    // https://github.com/ollama/ollama-js/pull/284
    max_results: Math.min(maxResults, 10),
  })

  return results.results.map((result, i) => ({
    id: `result_${i}`,
    // @ts-expect-error ollama apiの型と実装が一致していない
    title: result.title ?? 'UNKNOWN',
    // @ts-expect-error ollama apiの型と実装が一致していない
    url: result.url ?? 'UNKNOWN',
    content: result.content,
    source: 'ollama web search',
  }))
}
