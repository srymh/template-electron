import { matchesIndexRecord } from '../index-record'
import type { ObjectIndex, ObjectIndexRecord } from '../index-store'
import { compareObjectKeys } from '../key-order'
import {
  normalizeMetadata,
  validateIndexInput,
  validateIndexRecord,
  validateKey,
  validateListRange,
  validateRevision,
} from '../validation'

/** 永続化レコードを複製し、index境界を通した呼び出しをメモリだけで再現する。 */
export function createMemoryObjectIndex(): ObjectIndex {
  let revision = 0n
  const nextRevision = () => {
    if (revision === 9223372036854775807n)
      throw new RangeError('Object indexのrevisionを使い切りました。')
    revision += 1n
    return revision.toString()
  }
  const records = new Map<string, ObjectIndexRecord>()
  const sortedKeys = () => [...records.keys()].sort(compareObjectKeys)
  return {
    createOrMatch: async (input) => {
      const validated = validateIndexInput(input)
      // 照合から保存までawaitを挟まず、同じ状態に対して判定を完了する。
      const existing = records.get(validated.key)
      if (existing)
        return matchesIndexRecord(existing, validated)
          ? { status: 'matched', record: validateIndexRecord(existing) }
          : { status: 'conflict' }
      const record = { ...validated, revision: nextRevision() }
      records.set(record.key, record)
      return { status: 'created', record: validateIndexRecord(record) }
    },
    find: async (key) => {
      const record = records.get(validateKey(key))
      return record ? validateIndexRecord(record) : null
    },
    list: async function* () {
      // SQLiteと同じキー順にするため、Mapの挿入順ではなくUTF-8バイト列の順に並べてから列挙する。
      // 列挙中のsnapshot isolationはSQLiteと同様に保証しない。
      for (const key of sortedKeys()) {
        const record = records.get(key)
        if (record) yield validateIndexRecord(record)
      }
    },
    listRange: async (range) => {
      const { offset, limit } = validateListRange(range)
      return sortedKeys()
        .slice(offset, offset + limit)
        .map((key) => validateIndexRecord(records.get(key)!))
    },
    updateMetadata: async (key, expectedRevision, metadata) => {
      validateKey(key)
      validateRevision(expectedRevision)
      const normalized = normalizeMetadata(metadata)
      const existing = records.get(key)
      if (!existing || existing.revision !== expectedRevision) return null
      const updated = { ...existing, metadata: normalized, revision: nextRevision() }
      records.set(key, updated)
      return validateIndexRecord(updated)
    },
    rename: async (key, newKey, expectedRevision) => {
      validateKey(key)
      validateKey(newKey)
      validateRevision(expectedRevision)
      // 検査・採番・移動の間にawaitを挟まず、古いtokenによる変更も拒否する。
      const existing = records.get(key)
      if (!existing) return { status: 'missing-key' }
      if (existing.revision !== expectedRevision) return { status: 'revision-conflict' }
      if (key === newKey) return { status: 'unchanged', record: validateIndexRecord(existing) }
      if (records.has(newKey)) return { status: 'key-conflict' }
      const updated = validateIndexRecord({ ...existing, key: newKey, revision: nextRevision() })
      records.delete(key)
      records.set(newKey, updated)
      return { status: 'renamed', record: validateIndexRecord(updated) }
    },
    remove: async (key) => records.delete(validateKey(key)),
  }
}
