import type { DatabaseSync } from 'node:sqlite'

import ollama from 'ollama'

// -----------------------------------------------------------------------------
//
// 型定義
//
// -----------------------------------------------------------------------------

export type Initialize = () => void | Promise<void>

export type Insert = (
  docName: string,
  sourceChunkIndex: number,
  subIndex: number,
  content: string,
  embeddingJson: string,
) => void | Promise<void>

export type Finalize = () => void | Promise<void>

export type Handlers = {
  initialize: Initialize
  insert: Insert
  finalize: Finalize
}

export type CreateHandlers = (dbPath: string, docName: string) => Handlers | Promise<Handlers>

export type IngestDocumentsOptions = {
  /** データベースファイルのパス */
  dbPath: string
  /** ドキュメント名（同名のドキュメントが既に存在する場合は上書きされる） */
  docName: string
  /** チャンクテーブルの行を操作するためのハンドラーを作成する関数
   *
   * デフォルトでは `node:sqlite` を使用する内部実装が使われる。
   * カスタムストレージを使用する場合は `Handlers`（initialize / insert / finalize）を
   * 返す関数を渡すこと。
   *
   * @see createHandlersWithNodeSqlite （デフォルト実装）
   */
  createHandlers?: CreateHandlers

  /** チャンクのサイズ（文字数） */
  chunkSize?: number
  /** チャンク間のオーバーラップ（文字数） */
  overlap?: number

  /** 使用する埋め込みモデル（例: 'nomic-embed-text-v2-moe:latest'） */
  model: string
  /** 埋め込み用のテキストの前に追加するプレフィックス（例: 'search_document:'） */
  prefix?: string

  /** 埋め込み用のチャンクの最大文字数 */
  maxEmbeddingChars?: number
  /** 埋め込み用のチャンクのオーバーラップ */
  embeddingOverlap?: number

  /** 進捗コールバック（未指定時は何も出力しない） */
  onProgress?: (processed: number, total: number) => void
}

// -----------------------------------------------------------------------------
//
// 定数
//
// -----------------------------------------------------------------------------

const DEFAULT_CHUNK_SIZE = 900
const DEFAULT_OVERLAP = 120
// 埋め込み用のチャンクの最大文字数（モデルのトークン制限を考慮して設定）
const DEFAULT_MAX_EMBEDDING_CHARS = 700
const DEFAULT_EMBEDDING_OVERLAP = 120

/**
 * - id: チャンクの一意なID
 * - doc_name: ドキュメント名
 * - source_chunk_index: 元のテキストにおけるチャンクのインデックス
 * - sub_index: チャンク内のサブインデックス（オーバーラップ分を区別するため）
 * - content: チャンクのテキスト内容
 * - embedding_json: 埋め込みベクトルをJSON形式で保存するカラム
 */
const SQL_CREATE_TABLE = `CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_name TEXT NOT NULL,
  source_chunk_index INTEGER NOT NULL,
  sub_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_name);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_src ON chunks(doc_name, source_chunk_index);`

const SQL_DELETE_CHUNKS = `DELETE FROM chunks WHERE doc_name = ?`

const SQL_INSERT_CHUNKS = `INSERT INTO chunks (doc_name, source_chunk_index, sub_index, content, embedding_json)
VALUES (?, ?, ?, ?, ?)`

// -----------------------------------------------------------------------------
//
// 公開API
//
// -----------------------------------------------------------------------------

/**
 * ドキュメントをデータベースに取り込む
 *
 * テキストを指定したサイズのチャンクに分割し、各チャンクを埋め込みベクトルに変換して
 * データベースに保存します。
 * 同名のドキュメントが既に存在する場合は、既存のチャンクが削除されてから新しいチャンクが
 * 追加されます。
 *
 * @param text 取り込むテキスト
 * @param options 取り込みオプション
 */
export async function ingestDocuments(text: string, options: IngestDocumentsOptions) {
  const {
    dbPath,
    docName,
    createHandlers = createHandlersWithNodeSqlite,
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    model,
    prefix = '',
    maxEmbeddingChars = DEFAULT_MAX_EMBEDDING_CHARS,
    embeddingOverlap = DEFAULT_EMBEDDING_OVERLAP,
    onProgress,
  } = options

  const { initialize, insert, finalize } = await createHandlers(dbPath, docName)

  try {
    // 初期化する（データベース接続とテーブル作成、既存ドキュメントの削除）
    await initialize()

    // テキストをチャンクに分割する
    const chunks = chunkText(text, chunkSize, overlap)
    if (chunks.length === 0) {
      throw new Error('テキストをチャンクに分割できませんでした。')
    }

    // チャンクごとに処理する
    for (let idx = 0; idx < chunks.length; idx++) {
      const content = chunks[idx].trim()
      if (!content) {
        continue
      }

      const subChunks = splitForEmbedding(content, maxEmbeddingChars, embeddingOverlap)

      // サブチャンクごとに処理する
      for (let subIdx = 0; subIdx < subChunks.length; subIdx++) {
        const part = subChunks[subIdx]

        // テキストを埋め込みベクトルに変換する
        const embedding = await embedText(part, { model, prefix })

        // データベースに保存する
        await insert(docName, idx, subIdx, part, JSON.stringify(embedding))
      }

      // 進捗を通知する
      if ((idx + 1) % 10 === 0 || idx + 1 === chunks.length) {
        onProgress?.(idx + 1, chunks.length)
      }
    }
  } finally {
    // 途中で失敗してもデータベース接続を閉じる
    await finalize()
  }
}

// -----------------------------------------------------------------------------
//
// 内部関数
//
// -----------------------------------------------------------------------------

/**
 * テキストを指定サイズのスライスに分割する（オーバーラップ付き）
 *
 * @param text 分割するテキスト
 * @param size スライスのサイズ（文字数）
 * @param overlap スライス間のオーバーラップ（文字数）
 * @returns スライスの配列（空文字列のスライスは除外される）
 */
function sliceWithOverlap(text: string, size: number, overlap: number): Array<string> {
  const slices: Array<string> = []
  let i = 0

  while (i < text.length) {
    const end = Math.min(i + size, text.length)
    const slice = text.slice(i, end).trim()
    if (slice) {
      slices.push(slice)
    }

    // 最後のスライスに到達したら終了
    if (end === text.length) {
      break
    }

    // オーバーラップ分だけ戻る
    i = Math.max(0, end - overlap)
  }

  return slices
}

/**
 * テキストをチャンクに分割する
 *
 * テキストを正規化したうえで、指定サイズのチャンクに分割する。
 * チャンク間はオーバーラップさせることができる。
 * @param text 分割するテキスト
 * @param chunkSize チャンクのサイズ（文字数）
 * @param overlap チャンク間のオーバーラップ（文字数）
 * @returns チャンクの配列
 */
function chunkText(text: string, chunkSize: number, overlap: number) {
  // テキストをクリーンアップする
  const cleaned = text
    // 改行コードを統一
    .replace(/\r/g, '\n')
    // 行末のスペースとタブを削除
    .replace(/[ \t]+\n/g, '\n')
    // 連続する改行を2つにまとめる
    .replace(/\n{3,}/g, '\n\n')
    // 先頭と末尾のスペースと改行を削除
    .trim()

  return sliceWithOverlap(cleaned, chunkSize, overlap)
}

function splitForEmbedding(text: string, maxChars: number, overlap: number) {
  return sliceWithOverlap(text.trim(), maxChars, overlap)
}

/**
 * テキストを埋め込みベクトルに変換する
 * @param text 埋め込み対象のテキスト
 * @param options 埋め込みオプション
 * @param options.model 使用するモデル
 * @param options.prefix テキストの前に追加するプレフィックス
 * @returns 埋め込みベクトル
 */
async function embedText(
  text: string,
  options: {
    model: string
    prefix: string
  },
) {
  const { model, prefix } = options
  const res = await ollama.embeddings({
    model,
    prompt: `${prefix}${text}`,
  })
  return res.embedding
}

async function createHandlersWithNodeSqlite(
  dbPath: string,
  docName: string,
): Promise<{
  initialize: Initialize
  insert: Insert
  finalize: Finalize
}> {
  const { DatabaseSync } = await import('node:sqlite')

  let db: DatabaseSync | null = null
  let insertStmt: ReturnType<DatabaseSync['prepare']> | null = null

  const initialize = () => {
    if (db) {
      return
    }

    // データベースに接続する
    db = new DatabaseSync(dbPath)
    db.exec(SQL_CREATE_TABLE)

    // 同名のドキュメントの再取り込み対策: 既存を削除
    db.prepare(SQL_DELETE_CHUNKS).run(docName)

    // INSERT文を事前にプリペアする（insert() で再利用）
    insertStmt = db.prepare(SQL_INSERT_CHUNKS)
  }

  const insert = (
    docName: string,
    sourceChunkIndex: number,
    subIndex: number,
    content: string,
    embeddingJson: string,
  ) => {
    if (!insertStmt) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    insertStmt.run(docName, sourceChunkIndex, subIndex, content, embeddingJson)
  }

  const finalize = () => {
    if (!db) {
      return
    }

    db.close()
    db = null
    insertStmt = null
  }

  return { initialize, insert, finalize }
}
