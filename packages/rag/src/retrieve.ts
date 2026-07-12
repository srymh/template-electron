import type { DatabaseSync } from 'node:sqlite'

import ollama from 'ollama'

// -----------------------------------------------------------------------------
//
// 型定義
//
// -----------------------------------------------------------------------------

/** チャンクテーブルの行の型 */
export type ChunkRow = {
  /** チャンクID */
  id: number
  /** ドキュメントID */
  documentId: string
  /** ドキュメント名（source 表示用） */
  docName: string
  /** ドキュメント内のチャンクのインデックス（0始まり） */
  sourceChunkIdx: number
  /** サブインデックス（チャンク内の細分化された部分のインデックス、0始まり） */
  subIdx: number
  /** チャンクの内容 */
  content: string
  /**
   * チャンクの埋め込みベクトル
   * 型: number[]
   * 例: [0.1, 0.2, 0.3, ...]
   */
  embedding: Array<number>
}

/** チャンクテーブルの行の型（クエリとの類似度スコア付き） */
export type ChunkRowWithScore = Omit<ChunkRow, 'id' | 'embedding'> & {
  /** クエリとの類似度スコア */
  score: number
}

export type RetrieveFilter = {
  documentIds?: Array<string>
  docNames?: Array<string>
}

/** RAGコンテキストを取得するためのオプション */
export type RetrieveRagContextOptions = {
  /** データベースファイルのパス */
  dbPath: string
  /** 検索対象の絞り込み。未指定の場合は corpus 全体から検索する。 */
  filter?: RetrieveFilter

  /**
   * チャンクテーブルからチャンクを読み込む関数
   *
   * 例えば、SQLiteからチャンクを読み込む場合は以下のような関数を渡すことができます。
   * ```ts
   * const loadChunks = () => {
   *   const db = new sqlite3.Database('chunks.db')
   *   return new Promise<ChunkRow[]>((resolve, reject) => {
   *     db.all('SELECT id, documentId, docName, sourceChunkIdx, subIdx, content, embeddingJson FROM chunks', (err, rows) => {
   *       if (err) reject(err)
   *       else resolve(rows)
   *     })
   *   })
   * }
   * ```
   */
  loadChunks?: (
    dbPath: string,
    filter?: RetrieveFilter,
  ) => Array<ChunkRow> | Promise<Array<ChunkRow>>

  /** 使用する埋め込みモデル（例: 'nomic-embed-text-v2-moe:latest'） */
  model: string
  /** クエリのプレフィックス（例: 'search_query:'） */
  queryPrefix?: string
  /** 上位何件をコンテキストに含めるか（デフォルト: 6） */
  topK?: number
}

/** RAGコンテキスト */
export type RagContext = Array<ChunkRowWithScore>

// -----------------------------------------------------------------------------
//
// 定数
//
// -----------------------------------------------------------------------------

/** 取得する類似ドキュメントの数 */
const TOP_K = 6

const SQL_SELECT_CHUNKS = `SELECT id, document_id, doc_name, source_chunk_index, sub_index, content, embedding_json
FROM chunks`

// -----------------------------------------------------------------------------
//
// 公開API
//
// -----------------------------------------------------------------------------

/**
 * RAG（Retrieval-Augmented Generation）コンテキストを取得する
 * @param question クエリ（質問）
 * @param options 取得オプション
 * @returns RAGコンテキスト（類似ドキュメントの配列）
 * @remarks
 * - クエリを埋め込みベクトルに変換する
 * - チャンクテーブルから埋め込みベクトルの類似度が高い順に上位K件を取得する
 * - 取得したチャンクの内容とスコアをRAGコンテキストとして返す
 */
export async function retrieveRagContext(
  question: string,
  options: RetrieveRagContextOptions,
): Promise<RagContext> {
  const {
    dbPath,
    filter,
    loadChunks = loadChunksWithNodeSqlite,
    model,
    queryPrefix = '',
    topK = TOP_K,
  } = options

  // チャンクを読み込む
  const rows = await loadChunks(dbPath, filter)
  if (rows.length === 0) {
    throw new Error('チャンクテーブルが空です。チャンクをロードしてください。')
  }

  // クエリをベクトル化する
  const embeddedQuery = await embedQuery(question, { model, queryPrefix })

  // チャンクの埋め込みベクトルとクエリのベクトルの類似度を計算する
  const scoredRows: Array<ChunkRowWithScore> = []
  for (const row of rows) {
    const emb = row.embedding
    if (emb.length === 0) {
      continue // 埋め込みベクトルがない場合はスキップ
    }

    scoredRows.push({
      content: row.content,
      documentId: row.documentId,
      docName: row.docName,
      sourceChunkIdx: row.sourceChunkIdx,
      subIdx: row.subIdx,
      score: cosineSimilarity(embeddedQuery, emb),
    })
  }

  // 類似度が高い順にソートして上位K件を取得する
  const topRows = scoredRows.sort((a, b) => b.score - a.score).slice(0, topK)

  return topRows
}

// -----------------------------------------------------------------------------
//
// 内部関数
//
// -----------------------------------------------------------------------------

/** 値の型を検証するアサーション関数 */
type TypeMap = {
  string: string
  number: number
  boolean: boolean
}

function assertType<T extends keyof TypeMap>(
  value: unknown,
  expected: T,
  fieldName: string,
): asserts value is TypeMap[T] {
  if (typeof value !== expected) {
    throw new Error(`Invalid ${fieldName} in chunk row: expected ${expected}, got ${typeof value}`)
  }
}

async function loadChunksWithNodeSqlite(
  dbPath: string,
  filter?: RetrieveFilter,
): Promise<Array<ChunkRow>> {
  // 動的インポートを使用して、node:sqliteのDatabaseSyncクラスを読み込む
  // import { DatabaseSync } from 'node:sqlite'
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(dbPath)
  const hasDocumentId = hasColumn(db, 'chunks', 'document_id')
  const selectColumns = hasDocumentId
    ? SQL_SELECT_CHUNKS
    : `SELECT id, doc_name AS document_id, doc_name, source_chunk_index, sub_index, content, embedding_json
FROM chunks`
  const { sql, params } = buildSelectChunksQuery(selectColumns, filter, hasDocumentId)
  const stmt = db.prepare(sql)
  const rows = stmt.all(...params)
  const result = rows.map((row) => {
    const { id, document_id, doc_name, source_chunk_index, sub_index, content, embedding_json } =
      row

    assertType(id, 'number', 'id')
    assertType(document_id, 'string', 'document_id')
    assertType(doc_name, 'string', 'doc_name')
    assertType(source_chunk_index, 'number', 'source_chunk_index')
    assertType(sub_index, 'number', 'sub_index')
    assertType(content, 'string', 'content')

    const embeddingJson = typeof embedding_json === 'string' ? embedding_json : '[]'
    const embedding = JSON.parse(embeddingJson) as Array<number>

    return {
      id: id,
      documentId: document_id,
      docName: doc_name,
      sourceChunkIdx: source_chunk_index,
      subIdx: sub_index,
      content: content,
      embedding,
    }
  })
  db.close()
  return result
}

function hasColumn(db: DatabaseSync, table: string, name: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all()
  return rows.some((row) => {
    const { name: columnName } = row as { name?: unknown }
    return columnName === name
  })
}

function buildSelectChunksQuery(
  baseSql: string,
  filter: RetrieveFilter | undefined,
  hasDocumentId: boolean,
): {
  sql: string
  params: Array<string>
} {
  const conditions: Array<string> = []
  const params: Array<string> = []

  if (filter?.documentIds && filter.documentIds.length > 0) {
    const columnName = hasDocumentId ? 'document_id' : 'doc_name'
    conditions.push(`${columnName} IN (${filter.documentIds.map(() => '?').join(', ')})`)
    params.push(...filter.documentIds)
  }

  if (filter?.docNames && filter.docNames.length > 0) {
    conditions.push(`doc_name IN (${filter.docNames.map(() => '?').join(', ')})`)
    params.push(...filter.docNames)
  }

  if (conditions.length === 0) {
    return {
      sql: baseSql,
      params,
    }
  }

  return {
    sql: `${baseSql}\nWHERE ${conditions.join(' AND ')}`,
    params,
  }
}

/**
 * クエリをベクトル化する
 * Ollamaの埋め込みモデルを使用してクエリをベクトル化します。
 * @param query
 * @param options
 */
async function embedQuery(query: string, options: { model: string; queryPrefix: string }) {
  const { model, queryPrefix } = options
  const res = await ollama.embeddings({
    model,
    prompt: `${queryPrefix}${query}`,
  })
  return res.embedding
}

/**
 * コサイン類似度を計算する
 * @param vecA ベクトルA
 * @param vecB ベクトルB
 * @returns コサイン類似度（-1から1の範囲）
 * @remarks
 * - コサイン類似度は、2つのベクトルのなす角のコサイン値で表されます。
 * - 類似度が1に近いほど、2つのベクトルは似ていると判断されます。
 * - 類似度が-1に近いほど、2つのベクトルは反対方向を向いていると判断されます。
 * - 類似度が0に近いほど、2つのベクトルは直交していると判断されます。
 */
function cosineSimilarity(vecA: Array<number>, vecB: Array<number>): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`ベクトルの次元数が一致しません: vecA=${vecA.length}, vecB=${vecB.length}`)
  }

  let dot = 0 // ベクトルの内積
  let normA = 0 // ベクトルAのノルム（大きさ）
  let normB = 0 // ベクトルBのノルム（大きさ）

  for (let i = 0; i < vecA.length; i++) {
    const ai = vecA[i] // ベクトルAのi番目の要素
    const bi = vecB[i] // ベクトルBのi番目の要素
    dot += ai * bi // 内積を計算
    normA += ai * ai // ベクトルAのノルムの二乗を計算
    normB += bi * bi // ベクトルBのノルムの二乗を計算
  }

  // ノルムの積を計算
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) {
    return 0 // ノルムが0の場合は類似度を0とする
  }
  const similarity = dot / denominator // コサイン類似度を計算
  return similarity
}
