import type { ObjectListRange, ObjectMetadata, ObjectRevision, StoredObject } from './contracts'

/** index adapterだけが扱う、内容への参照を含む永続化レコード。 */
export type ObjectIndexRecord = StoredObject & { sha256: string }

/** revisionを含まない新規作成入力。採番はadapterが所有する。 */
export type CreateObjectIndexInput = Omit<ObjectIndexRecord, 'revision'>

/** 作成または現在状態との照合を一つの整合性境界で行った結果。 */
export type CreateOrMatchResult =
  | { status: 'created' | 'matched'; record: ObjectIndexRecord }
  | { status: 'conflict' }

/** キーの比較変更結果。失敗理由の判定も変更と同じ原子的な操作に含める。 */
export type RenameObjectIndexResult =
  | { status: 'renamed' | 'unchanged'; record: ObjectIndexRecord }
  | { status: 'missing-key' | 'revision-conflict' | 'key-conflict' }

/**
 * キーの作成・一致・競合判定、およびmetadata比較更新・キー変更とrevision発行を原子的に行う。
 * 更新不成立はnull。同一indexのcommit済み履歴内では削除後にもrevisionを再利用しない。
 * 外側transaction内の結果・revisionはcommitまで暫定値であり、hostは確定結果として
 * 外部へ公開・利用してはならない。rollback時はその結果を破棄する。
 */
export type ObjectIndex = {
  /** 操作中のある時点の状態と照合し、一致時は既存revisionを変更しない。 */
  createOrMatch: (input: CreateObjectIndexInput) => Promise<CreateOrMatchResult>
  find: (key: string) => Promise<ObjectIndexRecord | null>
  /** キーのUTF-8バイト列の昇順（UTF-8のDBでのSQLiteのBINARY照合と同じ）で列挙する。 */
  list: () => AsyncIterable<ObjectIndexRecord>
  /** listと同じ順序で、範囲内のレコードだけを返す。範囲より前のレコードを読み込まずに位置を決める。 */
  listRange: (range: ObjectListRange) => Promise<ObjectIndexRecord[]>
  updateMetadata: (
    key: string,
    expectedRevision: ObjectRevision,
    metadata: ObjectMetadata,
  ) => Promise<ObjectIndexRecord | null>
  /** 元revisionの一致・変更先の空きを検査し、キーと新revisionを原子的に更新する。 */
  rename: (
    key: string,
    newKey: string,
    expectedRevision: ObjectRevision,
  ) => Promise<RenameObjectIndexResult>
  remove: (key: string) => Promise<boolean>
}
