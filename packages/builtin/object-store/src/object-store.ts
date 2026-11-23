import type { Cas } from '@repo/cas'

import { validateContentStream } from './content-stream'
import type { ObjectPutResult, ObjectStore, StoredObject } from './contracts'
import { ObjectStoreError } from './contracts'
import type { CreateObjectIndexInput, ObjectIndex, ObjectIndexRecord } from './index-store'
import {
  normalizeMetadata,
  validateIndexRecord,
  validateKey,
  validateListRange,
  validateRevision,
} from './validation'

/** CASへの参照を通常の公開結果から除き、metadataも独立した値として返す。 */
function describe(record: ObjectIndexRecord): StoredObject {
  const { sha256: _sha256, ...object } = validateIndexRecord(record)
  return object
}

/** 内容の保存とキーindexを接続し、名前付きオブジェクトの操作を提供する。 */
export function createObjectStore(options: { cas: Cas; index: ObjectIndex }): ObjectStore {
  const { cas, index } = options
  const requireRecord = async (key: string) => {
    const record = await index.find(validateKey(key))
    if (!record) throw new ObjectStoreError('missing-key', key)
    return validateIndexRecord(record)
  }

  const putStream: ObjectStore['putStream'] = async (input): Promise<ObjectPutResult> => {
    // 入力を検証してから内容を確定する。index保存失敗時も本体は補償削除しない。
    const key = validateKey(input.key)
    const metadata = normalizeMetadata(input.metadata)
    const stored = await cas.putStream(input.content)
    const record: CreateObjectIndexInput = {
      key,
      sha256: stored.sha256,
      byteSize: stored.byteSize,
      metadata,
    }
    // 作成・一致・競合はindexが原子的に判定する。取得し直して判定結果を変えない。
    const result = await index.createOrMatch(record)
    if (result.status === 'conflict') throw new ObjectStoreError('key-conflict', key)
    return { created: result.status === 'created', object: describe(result.record) }
  }

  const readStream: ObjectStore['readStream'] = async (key, range) => {
    const requestedRange =
      range === undefined ? undefined : { offset: range.offset, length: range.length }
    const record = await requireRecord(key)
    const expectedByteSize = requestedRange?.length ?? record.byteSize
    try {
      const result = await cas.readStream(record.sha256, requestedRange)
      if (result.byteSize !== record.byteSize) throw new ObjectStoreError('corrupt-content', key)
      return {
        object: describe(record),
        content: validateContentStream(key, result.content, expectedByteSize),
      }
    } catch (error) {
      if (!(await cas.exists(record.sha256)))
        throw new ObjectStoreError('missing-content', key, { cause: error })
      throw error
    }
  }

  return {
    putStream,
    put: (input) => putStream({ ...input, content: singleChunk(input.content) }),
    find: async (key) => {
      const record = await index.find(validateKey(key))
      return record === null ? null : describe(record)
    },
    list: async function* () {
      for await (const record of index.list()) yield describe(record)
    },
    listRange: async (range) => (await index.listRange(validateListRange(range))).map(describe),
    readStream,
    read: async (key) => {
      const { object, content } = await readStream(key)
      const result = new Uint8Array(object.byteSize)
      let offset = 0
      for await (const chunk of content) {
        if (offset + chunk.byteLength > result.byteLength)
          throw new ObjectStoreError('corrupt-content', key)
        result.set(chunk, offset)
        offset += chunk.byteLength
      }
      if (offset !== result.byteLength) throw new ObjectStoreError('corrupt-content', key)
      return result
    },
    verify: async (key) => {
      const record = await index.find(validateKey(key))
      if (!record) return { status: 'missing-key' }
      const object = describe(record)
      const result = await cas.verify(record.sha256)
      if (result.status === 'missing') return { status: 'missing-content', object }
      return {
        status:
          result.status === 'valid' && result.byteSize === record.byteSize
            ? 'valid'
            : 'corrupt-content',
        object,
      }
    },
    updateMetadata: async ({ key, expectedRevision, metadata }) => {
      validateKey(key)
      validateRevision(expectedRevision)
      const updated = await index.updateMetadata(key, expectedRevision, normalizeMetadata(metadata))
      if (updated) return describe(updated)
      throw new ObjectStoreError((await index.find(key)) ? 'revision-conflict' : 'missing-key', key)
    },
    rename: async ({ key, newKey, expectedRevision }) => {
      validateKey(key)
      validateKey(newKey)
      validateRevision(expectedRevision)
      const result = await index.rename(key, newKey, expectedRevision)
      if (result.status === 'renamed' || result.status === 'unchanged')
        return describe(result.record)
      throw new ObjectStoreError(result.status, result.status === 'key-conflict' ? newKey : key)
    },
    // 本体回収は提供しない。別キーと外部参照を保持したままキーだけを削除する。
    remove: (key) => index.remove(validateKey(key)),
  }
}

async function* singleChunk(content: Uint8Array): AsyncIterable<Uint8Array> {
  yield content
}
