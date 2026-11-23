import { TodoItemSchema } from './schema'
import type { TodoItem } from './schema'
import type { TodoStorage } from './storage'

/**
 * SQLite 同期 API の最小IF。
 *
 * この実装は `exec/prepare` を持つ「同期 SQLite」互換のDBを受け取る。
 * 既定の想定は `node:sqlite`（組み込み）だが、同等のAPIを持つ実装なら差し替え可能。
 * （ブラウザ/WASM などで SQLite を使う場合も、薄いアダプタを作れば利用できる）
 */
type SqliteStatement = {
  all: (...args: any[]) => any[]
  get: (...args: any[]) => any
  run: (...args: any[]) => any
}

type SqliteDatabaseSync = {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
}

type TodoRow = {
  id: string
  title: string
  description: string | null
  completed: 0 | 1
  created_at: string
  updated_at: string
}

function todoFromRow(row: TodoRow): TodoItem {
  const item: TodoItem = {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    completed: row.completed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

  return TodoItemSchema.parse(item)
}

/**
 * SQLite（node:sqlite / DatabaseSync）ベースのストレージ実装を作成する。
 *
 * テーブルはこの関数内で `CREATE TABLE IF NOT EXISTS` する。
 */
export async function createTodoSqliteStorage(db: SqliteDatabaseSync): Promise<TodoStorage> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  return {
    async list(): Promise<TodoItem[]> {
      const stmt = db.prepare(
        `SELECT id, title, description, completed, created_at, updated_at
         FROM todos
         ORDER BY created_at ASC, id ASC`,
      )
      const rows = stmt.all() as TodoRow[]
      return rows.map(todoFromRow)
    },

    async get(id: string): Promise<TodoItem | null> {
      const stmt = db.prepare(
        `SELECT id, title, description, completed, created_at, updated_at
         FROM todos
         WHERE id = ?`,
      )
      const row = stmt.get(id) as TodoRow | undefined
      if (!row) return null
      return todoFromRow(row)
    },

    async upsert(item: TodoItem): Promise<void> {
      const validated = TodoItemSchema.parse(item)
      const stmt = db.prepare(
        `INSERT INTO todos (id, title, description, completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           completed = excluded.completed,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
      )
      stmt.run(
        validated.id,
        validated.title,
        validated.description ?? null,
        validated.completed ? 1 : 0,
        validated.createdAt,
        validated.updatedAt,
      )
    },

    async delete(id: string): Promise<void> {
      const stmt = db.prepare('DELETE FROM todos WHERE id = ?')
      stmt.run(id)
    },
  }
}

export type { SqliteDatabaseSync }
