import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createFileSystemCas, hashCasContent } from './index'

const temporaryRoots: string[] = []

async function createTestCas() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'object-cas-'))
  temporaryRoots.push(root)
  return { cas: createFileSystemCas(root), root }
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  )
})

describe('汎用CAS', () => {
  it('同時保存を排他的に確定し、空内容も重複なく保存する', async () => {
    const { cas } = await createTestCas()
    const results = await Promise.all(Array.from({ length: 8 }, () => cas.put(new Uint8Array())))
    expect(results.filter((result) => result.created)).toHaveLength(1)
    await expect(cas.list()).resolves.toHaveLength(1)
    const empty = await cas.readStream(results[0].sha256, { offset: 0, length: 0 })
    expect(await collect(empty.content)).toEqual(new Uint8Array())
  })

  it('stream途中の失敗・期待サイズ不一致ではobjectを公開せず、一時ファイルを片付ける', async () => {
    const { cas, root } = await createTestCas()
    const broken = (async function* () {
      yield new Uint8Array([1])
      throw new Error('source failed')
    })()
    await expect(cas.putStream(broken)).rejects.toThrow('source failed')
    await expect(cas.put(new Uint8Array([1]), { expectedByteSize: 2 })).rejects.toThrow('期待値')
    await expect(cas.put(new Uint8Array([1]), { expectedByteSize: -1 })).rejects.toThrow(
      'byte size',
    )
    await expect(cas.list()).resolves.toEqual([])
    expect(await fs.readdir(path.join(root, '.tmp'))).toEqual([])
  })

  it('拡張子に依存しないcontent addressへ同じ内容を一度だけ保存する', async () => {
    const { cas, root } = await createTestCas()
    const content = new Uint8Array([1, 2, 3, 4])
    const sha256 = hashCasContent(content)

    await expect(cas.put(content)).resolves.toEqual({
      sha256,
      byteSize: 4,
      created: true,
    })
    await expect(cas.put(content)).resolves.toEqual({
      sha256,
      byteSize: 4,
      created: false,
    })

    expect(cas.resolvePath(sha256)).toBe(path.join(root, 'sha256', sha256.slice(0, 2), sha256))
    await expect(cas.read(sha256)).resolves.toEqual(content)
    await expect(cas.list()).resolves.toEqual([{ sha256, byteSize: 4 }])
    await expect(cas.verify(sha256)).resolves.toEqual({
      status: 'valid',
      sha256,
      byteSize: 4,
    })
  })

  it('保存内容の破損とobjectの欠落を区別する', async () => {
    const { cas } = await createTestCas()
    const stored = await cas.put(new Uint8Array([1, 2, 3]))

    await fs.writeFile(cas.resolvePath(stored.sha256), new Uint8Array([9, 9]))
    await expect(cas.verify(stored.sha256)).resolves.toEqual({
      status: 'corrupt',
      sha256: stored.sha256,
      byteSize: 2,
      actualSha256: hashCasContent(new Uint8Array([9, 9])),
    })
    await expect(cas.put(new Uint8Array([1, 2, 3]))).rejects.toThrow(
      'CAS objectの内容がdigestと一致しません',
    )

    await cas.remove(stored.sha256)
    await expect(cas.verify(stored.sha256)).resolves.toEqual({ status: 'missing' })
    await expect(cas.list()).resolves.toEqual([])
  })

  it('不正なdigestを保存先パスへ展開しない', async () => {
    const { cas } = await createTestCas()
    expect(() => cas.resolvePath('../outside')).toThrow('不正なSHA-256 digest')
  })

  it('streamを一度だけ走査して保存する', async () => {
    const { cas } = await createTestCas()
    const byteSize = 10 * 1024 * 1024 + 1
    const chunk = new Uint8Array(64 * 1024).fill(0xa5)
    let iterations = 0
    const content = (async function* () {
      iterations += 1
      for (let offset = 0; offset < byteSize; offset += chunk.byteLength) {
        yield chunk.subarray(0, Math.min(chunk.byteLength, byteSize - offset))
      }
    })()

    const stored = await cas.putStream(content)

    expect(iterations).toBe(1)
    expect(stored).toMatchObject({ byteSize, created: true })
    await expect(cas.verify(stored.sha256)).resolves.toEqual({
      status: 'valid',
      sha256: stored.sha256,
      byteSize,
    })
  })

  it('保存内容を全量または指定範囲でストリーム読み取りする', async () => {
    const { cas } = await createTestCas()
    const stored = await cas.put(new Uint8Array([1, 2, 3, 4]))

    const full = await cas.readStream(stored.sha256)
    expect(full.byteSize).toBe(4)
    expect(await collect(full.content)).toEqual(new Uint8Array([1, 2, 3, 4]))

    const partial = await cas.readStream(stored.sha256, { offset: 1, length: 2 })
    expect(partial.byteSize).toBe(4)
    expect(await collect(partial.content)).toEqual(new Uint8Array([2, 3]))
    await expect(cas.readStream(stored.sha256, { offset: 4, length: 1 })).rejects.toThrow(
      'CAS読み取り範囲が不正',
    )
  })

  it('保存root外へのsymlinkをストリーム経由で読まない', async () => {
    const { cas } = await createTestCas()
    const stored = await cas.put(new Uint8Array([1, 2, 3]))
    const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'object-cas-outside-'))
    temporaryRoots.push(outsideRoot)
    const outsideFile = path.join(outsideRoot, 'secret')
    await fs.writeFile(outsideFile, new Uint8Array([9]))
    await fs.unlink(cas.resolvePath(stored.sha256))
    await fs.symlink(outsideFile, cas.resolvePath(stored.sha256))

    await expect(cas.readStream(stored.sha256)).rejects.toThrow('保存root外')
  })
})

async function collect(content: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: number[] = []
  for await (const chunk of content) chunks.push(...chunk)
  return new Uint8Array(chunks)
}
