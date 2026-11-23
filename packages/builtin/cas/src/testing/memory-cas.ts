import { createHash } from 'node:crypto'

import type { Cas, CasObject, CasPutOptions, CasPutResult } from '../index'
import { assertCasReadRange } from '../read-range'
import { validateByteSize } from '../validation'

const sha256Pattern = /^[0-9a-f]{64}$/

/** テストから保存内容を直接変更できるmemory CAS fixture。 */
export type MemoryCas = Cas & {
  overwrite: (sha256: string, content: Uint8Array) => void
}

/** filesystem I/OなしでCAS利用側をテストするためのmemory実装を作成する。 */
export function createMemoryCas(): MemoryCas {
  const objects = new Map<string, Uint8Array>()

  const verify: Cas['verify'] = async (sha256) => {
    assertSha256(sha256)
    const content = objects.get(sha256)
    if (!content) return { status: 'missing' }

    const actualSha256 = hashContent(content)
    const object = { sha256, byteSize: content.byteLength }
    return actualSha256 === sha256
      ? { status: 'valid', ...object }
      : { status: 'corrupt', ...object, actualSha256 }
  }

  const putStream: Cas['putStream'] = async (content, putOptions) => {
    const validatedPutOptions = validatePutOptions(putOptions)
    const chunks: Uint8Array[] = []
    const hash = createHash('sha256')
    let byteSize = 0

    for await (const chunk of content) {
      if (!(chunk instanceof Uint8Array)) {
        throw new Error('CAS streamはUint8Arrayの反復として指定してください。')
      }
      if (chunk.byteLength === 0) continue

      byteSize += chunk.byteLength
      if (!Number.isSafeInteger(byteSize)) {
        throw new Error('CAS objectのbyte sizeが安全に表現できる範囲を超えました。')
      }
      const copiedChunk = new Uint8Array(chunk)
      chunks.push(copiedChunk)
      hash.update(copiedChunk)
    }

    const sha256 = hash.digest('hex')
    if (
      validatedPutOptions?.expectedByteSize !== undefined &&
      validatedPutOptions.expectedByteSize !== byteSize
    ) {
      throw new Error(
        `CAS objectの実測byte sizeが期待値と一致しません（期待値: ${validatedPutOptions.expectedByteSize}、実測値: ${byteSize}）。`,
      )
    }
    const existing = await verify(sha256)
    let result: CasPutResult
    if (existing.status === 'valid') {
      result = { sha256, byteSize, created: false }
    } else if (existing.status === 'corrupt') {
      throw new Error(`CAS objectの内容がdigestと一致しません: ${sha256}`)
    } else {
      const stored = new Uint8Array(byteSize)
      let offset = 0
      for (const chunk of chunks) {
        stored.set(chunk, offset)
        offset += chunk.byteLength
      }
      objects.set(sha256, stored)
      result = { sha256, byteSize, created: true }
    }

    return result
  }

  return {
    put: async (content, putOptions) => putStream(singleChunkStream(content), putOptions),
    putStream,
    read: async (sha256) => {
      assertSha256(sha256)
      const content = objects.get(sha256)
      if (!content) throw new Error(`CAS objectが見つかりません: ${sha256}`)
      return new Uint8Array(content)
    },
    readStream: async (sha256, range) => {
      assertSha256(sha256)
      const content = objects.get(sha256)
      if (!content) throw new Error(`CAS objectが見つかりません: ${sha256}`)
      assertCasReadRange(range, content.byteLength)
      const offset = range?.offset ?? 0
      const length = range?.length ?? content.byteLength
      return {
        byteSize: content.byteLength,
        content: singleChunkStream(new Uint8Array(content.subarray(offset, offset + length))),
      }
    },
    list: async () =>
      [...objects.entries()]
        .map(([sha256, content]): CasObject => ({ sha256, byteSize: content.byteLength }))
        .sort((left, right) => left.sha256.localeCompare(right.sha256)),
    exists: async (sha256) => {
      assertSha256(sha256)
      return objects.has(sha256)
    },
    verify,
    remove: async (sha256) => {
      assertSha256(sha256)
      objects.delete(sha256)
    },
    overwrite: (sha256, content) => {
      assertSha256(sha256)
      objects.set(sha256, new Uint8Array(content))
    },
  }
}

function validatePutOptions(options: CasPutOptions | undefined): CasPutOptions | undefined {
  if (!options) return undefined
  return options.expectedByteSize === undefined
    ? {}
    : { expectedByteSize: validateByteSize(options.expectedByteSize) }
}

async function* singleChunkStream(content: Uint8Array): AsyncIterable<Uint8Array> {
  yield content
}

function hashContent(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

function assertSha256(sha256: string): void {
  if (!sha256Pattern.test(sha256)) {
    throw new Error(`不正なSHA-256 digestです: ${sha256}`)
  }
}
