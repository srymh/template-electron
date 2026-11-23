import { DatabaseSync } from 'node:sqlite'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMemoryCas } from '@repo/cas/testing'
import { createDatabase } from '@repo/sqlite'
import type { SqliteDatabaseHandle } from '@repo/sqlite'

import { createObjectStore } from './index'
import type { JsonValue } from './index'
import { createSqliteObjectIndex } from './sqlite'
import { createMemoryObjectIndex } from './testing'

const closeCallbacks: Array<() => void> = []
afterEach(() => {
  for (const close of closeCallbacks.splice(0)) close()
})

function setup(adapter: 'memory' | 'sqlite') {
  const cas = createMemoryCas()
  const database = adapter === 'sqlite' ? new DatabaseSync(':memory:') : null
  if (database) closeCallbacks.push(() => database.close())
  const index = database
    ? createSqliteObjectIndex(createDatabase(database as unknown as SqliteDatabaseHandle))
    : createMemoryObjectIndex()
  return { cas, index, store: createObjectStore({ cas, index }) }
}

describe.each(['memory', 'sqlite'] as const)('object store (%s index)', (adapter) => {
  it('キー変更は本体にアクセスせずmetadataを保持し、新revisionで旧キーを失効させる', async () => {
    const { store, cas, index } = setup(adapter)
    const original = await store.put({
      key: 'wrong',
      content: new Uint8Array([1, 2]),
      metadata: { fileName: 'original.png', attributes: { source: 'manual' } },
    })
    const read = vi.spyOn(cas, 'readStream')
    const put = vi.spyOn(cas, 'putStream')
    const renamed = await store.rename({
      key: 'wrong',
      newKey: 'correct/予定 ?#.png ',
      expectedRevision: original.object.revision,
    })
    expect(renamed).toMatchObject({
      ...original.object,
      key: 'correct/予定 ?#.png ',
      revision: expect.any(String),
    })
    expect(renamed.revision).not.toBe(original.object.revision)
    expect(await store.find('wrong')).toBeNull()
    expect(await index.find(renamed.key)).toMatchObject({ sha256: (await cas.list())[0].sha256 })
    expect(read).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(await store.read(renamed.key)).toEqual(new Uint8Array([1, 2]))
    const recreated = await store.put({ key: 'wrong', content: new Uint8Array([1, 2]) })
    await expect(
      store.rename({ key: 'wrong', newKey: 'next', expectedRevision: original.object.revision }),
    ).rejects.toMatchObject({ code: 'revision-conflict' })
    expect(await store.find('wrong')).toEqual(recreated.object)
  })

  it('変更先が同じ内容でも占有されていれば両キーを保持し、古いrevisionや欠落を拒否する', async () => {
    const { store } = setup(adapter)
    const a = (await store.put({ key: 'a', content: new Uint8Array([1]) })).object
    const b = (await store.put({ key: 'b', content: new Uint8Array([1]) })).object
    await expect(
      store.rename({ key: 'a', newKey: 'b', expectedRevision: a.revision }),
    ).rejects.toMatchObject({ code: 'key-conflict', key: 'b' })
    await expect(
      store.rename({ key: 'a', newKey: 'c', expectedRevision: b.revision }),
    ).rejects.toMatchObject({ code: 'revision-conflict' })
    await expect(
      store.rename({ key: 'missing', newKey: 'c', expectedRevision: a.revision }),
    ).rejects.toMatchObject({ code: 'missing-key' })
    expect(await store.find('a')).toEqual(a)
    expect(await store.find('b')).toEqual(b)
    expect(await store.rename({ key: 'a', newKey: 'a', expectedRevision: a.revision })).toEqual(a)
    await expect(
      store.rename({ key: 'a', newKey: 'a//bad', expectedRevision: a.revision }),
    ).rejects.toThrow()
    expect(await store.find('a')).toEqual(a)
  })

  it('同じ変更先への並行変更は一件だけ成功し、もう一方の元キーを保持する', async () => {
    const { store } = setup(adapter)
    const a = (await store.put({ key: 'a', content: new Uint8Array([1]) })).object
    const b = (await store.put({ key: 'b', content: new Uint8Array([2]) })).object
    const results = await Promise.allSettled(
      [a, b].map((object) =>
        store.rename({ key: object.key, newKey: 'target', expectedRevision: object.revision }),
      ),
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect((await collectItems(store.list())).length).toBe(2)
  })

  it('別キーの同じ内容を一つの本体で保持し、metadataと削除を独立させる', async () => {
    const { store, cas } = setup(adapter)
    const content = new Uint8Array([1, 2, 3])
    const first = await store.put({
      key: 'images/画像.png',
      content,
      metadata: { mediaType: 'IMAGE/PNG', attributes: { purpose: 'preview' } },
    })
    const second = await store.put({
      key: 'files/画像.bin',
      content,
      metadata: { mediaType: 'application/octet-stream', fileName: '画像.bin' },
    })
    expect(first.created).toBe(true)
    expect(second.created).toBe(true)
    expect(first.object).not.toHaveProperty('sha256')
    expect(first.object.metadata.mediaType).toBe('image/png')
    expect(await cas.list()).toHaveLength(1)
    expect(await collectItems(store.list())).toHaveLength(2)
    await expect(store.remove(first.object.key)).resolves.toBe(true)
    await expect(store.remove(first.object.key)).resolves.toBe(false)
    await expect(store.find(first.object.key)).resolves.toBeNull()
    await expect(store.read(second.object.key)).resolves.toEqual(content)
    expect(await cas.list()).toHaveLength(1)
  })

  it('最後のキーを削除しても本体を回収しない', async () => {
    // Arrange
    const { store, cas } = setup(adapter)
    await store.put({ key: 'last', content: new Uint8Array([1]) })
    const bodiesBeforeRemoval = await cas.list()

    // Act
    const removed = await store.remove('last')
    const objectAfterRemoval = await store.find('last')
    const bodiesAfterRemoval = await cas.list()

    // Assert
    expect(removed).toBe(true)
    expect(objectAfterRemoval).toBeNull()
    expect(bodiesBeforeRemoval).toHaveLength(1)
    expect(bodiesAfterRemoval).toEqual(bodiesBeforeRemoval)
  })

  it('属性順に依存せず再登録を冪等化し、内容やmetadataの変更は拒否する', async () => {
    const { store } = setup(adapter)
    const content = new Uint8Array([1])
    const first = await store.put({
      key: 'same',
      content,
      metadata: { attributes: { a: 1, b: 2 } },
    })
    await expect(
      store.put({ key: 'same', content, metadata: { attributes: { b: 2, a: 1 } } }),
    ).resolves.toEqual({ created: false, object: first.object })
    await expect(store.put({ key: 'same', content: new Uint8Array([2]) })).rejects.toMatchObject({
      code: 'key-conflict',
    })
    await expect(
      store.put({ key: 'same', content, metadata: { fileName: 'changed' } }),
    ).rejects.toMatchObject({ code: 'key-conflict' })
    await expect(store.read('same')).resolves.toEqual(content)
    await expect(store.find('same')).resolves.toEqual(first.object)
  })

  it('競合する新規キーの登録では一件だけが勝ち、既存内容を置換しない', async () => {
    const { store } = setup(adapter)
    const results = await Promise.allSettled(
      [1, 2].map((value) => store.put({ key: 'race', content: new Uint8Array([value]) })),
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const winner = await store.read('race')
    expect([1, 2]).toContain(winner[0])
  })

  it('putは更新後のmetadataに対して冪等性を判定し、現在のrevisionを維持する', async () => {
    const { store } = setup(adapter)
    const content = new Uint8Array([1])
    const original = await store.put({ key: 'current', content, metadata: { fileName: 'old' } })
    const updated = await store.updateMetadata({
      key: 'current',
      expectedRevision: original.object.revision,
      metadata: { fileName: 'new' },
    })
    await expect(
      store.put({ key: 'current', content, metadata: { fileName: 'old' } }),
    ).rejects.toMatchObject({ code: 'key-conflict' })
    await expect(
      store.put({ key: 'current', content, metadata: { fileName: 'new' } }),
    ).resolves.toEqual({ created: false, object: updated })
  })

  it('Web Cryptoなしで登録・metadata更新を行える', async () => {
    const { store } = setup(adapter)
    vi.stubGlobal('crypto', undefined)
    try {
      const created = await store.put({ key: 'runtime-independent', content: new Uint8Array([1]) })
      const updated = await store.updateMetadata({
        key: created.object.key,
        expectedRevision: created.object.revision,
        metadata: { fileName: 'updated' },
      })
      expect(updated.revision).not.toBe(created.object.revision)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('一致判定の直後にmetadataが更新されても、putは判定時点の結果を返す', async () => {
    const { store, index } = setup(adapter)
    const input = {
      key: 'matched-snapshot',
      content: new Uint8Array([1]),
      metadata: { fileName: 'before' },
    }
    const original = await store.put(input)
    const createOrMatch = index.createOrMatch.bind(index)
    vi.spyOn(index, 'createOrMatch').mockImplementationOnce(async (record) => {
      const result = await createOrMatch(record)
      if (result.status !== 'matched') throw new Error('fixture must match')
      await index.updateMetadata(record.key, result.record.revision, {
        mediaType: null,
        fileName: 'after',
        attributes: null,
      })
      return result
    })
    await expect(store.put(input)).resolves.toEqual({ created: false, object: original.object })
    await expect(store.find(input.key)).resolves.toMatchObject({ metadata: { fileName: 'after' } })
  })

  it('CASのdigestが正常でもindexのbyteSizeが異なればcorrupt-contentとする', async () => {
    const { store, index, cas } = setup(adapter)
    await store.put({ key: 'size-mismatch', content: new Uint8Array([1]) })
    const record = await index.find('size-mismatch')
    if (!record) throw new Error('fixture missing')
    await expect(cas.verify(record.sha256)).resolves.toMatchObject({ status: 'valid', byteSize: 1 })
    vi.spyOn(index, 'find').mockResolvedValue({ ...record, byteSize: 2 })
    await expect(store.verify('size-mismatch')).resolves.toMatchObject({
      status: 'corrupt-content',
    })
    await expect(store.read('size-mismatch')).rejects.toMatchObject({ code: 'corrupt-content' })
  })

  it('metadataを比較更新し、並行更新と削除後の再作成に対する古いtokenを拒否する', async () => {
    const { store } = setup(adapter)
    const first = await store.put({ key: 'revision', content: new Uint8Array([1]) })
    const results = await Promise.allSettled(
      ['one', 'two'].map((fileName) =>
        store.updateMetadata({
          key: 'revision',
          expectedRevision: first.object.revision,
          metadata: { fileName },
        }),
      ),
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toMatchObject([
      { reason: { code: 'revision-conflict' } },
    ])
    await store.remove('revision')
    await store.put({ key: 'revision', content: new Uint8Array([9]) })
    await expect(
      store.updateMetadata({
        key: 'revision',
        expectedRevision: first.object.revision,
        metadata: {},
      }),
    ).rejects.toMatchObject({ code: 'revision-conflict' })
  })

  it('入力と取得結果のmetadataを変更しても保存値は変わらない', async () => {
    const { store } = setup(adapter)
    const attributes = { names: ['original'] }
    const stored = await store.put({
      key: 'copy',
      content: new Uint8Array(),
      metadata: { attributes },
    })
    attributes.names.push('input changed')
    const returned = stored.object.metadata.attributes as { names: string[] }
    returned.names.push('output changed')
    expect((await store.find('copy'))?.metadata.attributes).toEqual({ names: ['original'] })
  })

  it('keyをpathへ正規化せず、空白・大小文字・特殊文字を保持する', async () => {
    const { store } = setup(adapter)
    const keys = ['a', 'a/b', '.hidden/..backup', ' A?#%/画像 ', 'a%_', 'literal/%2F/%2E%2E']
    for (const key of keys) await store.put({ key, content: new Uint8Array([1]) })
    expect(new Set((await collectItems(store.list())).map((object) => object.key))).toEqual(
      new Set(keys),
    )
    await expect(store.find('A')).resolves.toBeNull()
  })

  describe('列挙の順序と範囲取得', () => {
    // UTF-8のバイト列の昇順: B(42) < a(61) < a/b(61 2F) < あ(E3) < Ａ(EF BC A1) < 😀(F0)。
    // UTF-16 code unit順では😀(D83D)がＡ(FF21)より前になるため、その差も検出する。
    const keysInUtf8Order = ['B', 'a', 'a/b', 'あ', 'Ａ', '😀']

    /** 挿入順に依存しないことを確かめるため、期待順とは逆の順で登録する。 */
    async function putInReverseOrder(store: ReturnType<typeof setup>['store']) {
      for (const key of [...keysInUtf8Order].reverse())
        await store.put({ key, content: new Uint8Array([1]) })
    }

    it('挿入順やUTF-16の順序ではなく、キーのUTF-8バイト列の昇順で列挙する', async () => {
      // Arrange
      const { store } = setup(adapter)
      await putInReverseOrder(store)

      // Act
      const listed = await collectItems(store.list())

      // Assert
      expect(listed.map(({ key }) => key)).toEqual(keysInUtf8Order)
    })

    it.each([
      { name: '先頭', range: { offset: 0, limit: 2 }, expected: ['B', 'a'] },
      { name: '途中', range: { offset: 2, limit: 2 }, expected: ['a/b', 'あ'] },
      {
        name: '末尾（limitが残りより多い）',
        range: { offset: 4, limit: 10 },
        expected: ['Ａ', '😀'],
      },
      { name: '最後の1件', range: { offset: 5, limit: 1 }, expected: ['😀'] },
      { name: '全件ちょうど', range: { offset: 0, limit: 6 }, expected: keysInUtf8Order },
      { name: '範囲外（offsetが件数と同じ）', range: { offset: 6, limit: 1 }, expected: [] },
    ])('範囲取得は$nameの範囲をキーのUTF-8バイト列の昇順で返す', async ({ range, expected }) => {
      // Arrange
      const { store } = setup(adapter)
      await putInReverseOrder(store)

      // Act
      const listed = await store.listRange(range)

      // Assert
      expect(listed.map(({ key }) => key)).toEqual(expected)
    })

    it('空のstoreの範囲取得は空配列を返す', async () => {
      // Arrange
      const { store } = setup(adapter)

      // Act
      const listed = await store.listRange({ offset: 0, limit: 10 })

      // Assert
      expect(listed).toEqual([])
    })

    it('範囲取得のoffsetを取得件数分ずつ進めると、全キーを欠落・重複なく取得する', async () => {
      // Arrange
      const { store } = setup(adapter)
      const keys = Array.from({ length: 250 }, (_, index) => `k/${String(index).padStart(3, '0')}`)
      for (const key of [...keys].reverse()) await store.put({ key, content: new Uint8Array([1]) })

      // Act
      const listedKeys: string[] = []
      for (let offset = 0; ; offset += 30) {
        const page = await store.listRange({ offset, limit: 30 })
        listedKeys.push(...page.map(({ key }) => key))
        if (page.length < 30) break
      }

      // Assert
      expect(listedKeys).toEqual(keys)
    })

    it.each([
      { name: '負のoffset', range: { offset: -1, limit: 1 } },
      { name: '小数のoffset', range: { offset: 0.5, limit: 1 } },
      { name: '0件のlimit', range: { offset: 0, limit: 0 } },
      { name: '数値でないlimit', range: { offset: 0, limit: Number.NaN } },
    ])('範囲取得に$nameを指定すると拒否する', async ({ range }) => {
      // Arrange
      const { store } = setup(adapter)

      // Act / Assert
      await expect(store.listRange(range)).rejects.toThrow(RangeError)
    })
  })

  it('UTF-8の1024バイト境界をASCII・日本語・非BMP文字で適用する', async () => {
    const { store } = setup(adapter)
    for (const key of ['a'.repeat(1024), 'あ'.repeat(341) + 'a', '😀'.repeat(256)]) {
      await store.put({ key, content: new Uint8Array([1]) })
      await expect(store.find(key)).resolves.toMatchObject({ key })
    }
    for (const key of ['a'.repeat(1025), 'あ'.repeat(341) + 'ab', '😀'.repeat(256) + 'a']) {
      await expect(store.put({ key, content: new Uint8Array() })).rejects.toThrow('Object key')
    }
  })

  it('不正なキーを保存前に拒否し、参照や削除でも同じ制約を適用する', async () => {
    const { store, cas } = setup(adapter)
    const invalidKeys = [
      '',
      '\0',
      '\n',
      'a\rb',
      'a\tb',
      '\u007F',
      '\u0085',
      '\u009F',
      '\uD800',
      '\uDC00',
      'a/\uD800b',
      '/',
      '/a',
      'a/',
      'a//b',
      '.',
      '..',
      './a',
      '../a',
      'a/./b',
      'a/../b',
      'a/.',
      'a/..',
      'a\\b',
    ]
    for (const key of invalidKeys) {
      await expect(store.put({ key, content: new Uint8Array([1]) })).rejects.toThrow('Object key')
      await expect(store.find(key)).rejects.toThrow('Object key')
      await expect(store.read(key)).rejects.toThrow('Object key')
      await expect(async () => store.remove(key)).rejects.toThrow('Object key')
    }
    await expect(cas.list()).resolves.toEqual([])
  })

  it('streamを一度だけ読み、部分取得・空内容を扱う', async () => {
    const { store } = setup(adapter)
    let iterations = 0
    const content = (async function* () {
      iterations += 1
      yield new Uint8Array([1, 2])
      yield new Uint8Array([3])
    })()
    await store.putStream({ key: 'stream', content })
    expect(iterations).toBe(1)
    const partial = await store.readStream('stream', { offset: 1, length: 2 })
    expect(partial.object.byteSize).toBe(3)
    expect(await collect(partial.content)).toEqual([2, 3])
    await expect(store.readStream('stream', { offset: 3, length: 1 })).rejects.toThrow(RangeError)
    await store.put({ key: 'empty', content: new Uint8Array() })
    await expect(store.read('empty')).resolves.toEqual(new Uint8Array())
  })

  it('キー欠落・内容欠落・同サイズの内容破損を区別する', async () => {
    const { store, cas } = setup(adapter)
    await expect(store.verify('unknown')).resolves.toEqual({ status: 'missing-key' })
    await expect(store.read('unknown')).rejects.toMatchObject({ code: 'missing-key' })
    await store.put({ key: 'broken', content: new Uint8Array([1]) })
    const [blob] = await cas.list()
    cas.overwrite(blob.sha256, new Uint8Array([9]))
    await expect(store.read('broken')).resolves.toEqual(new Uint8Array([9]))
    const partial = await store.readStream('broken', { offset: 0, length: 1 })
    expect(await collect(partial.content)).toEqual([9])
    await expect(store.verify('broken')).resolves.toMatchObject({ status: 'corrupt-content' })
    await cas.remove(blob.sha256)
    await expect(store.verify('broken')).resolves.toMatchObject({ status: 'missing-content' })
    await expect(store.read('broken')).rejects.toMatchObject({ code: 'missing-content' })
  })

  it('index保存失敗後に本体を残し、再実行で登録を完了する', async () => {
    const { store, cas, index } = setup(adapter)
    vi.spyOn(index, 'createOrMatch').mockRejectedValueOnce(new Error('index unavailable'))
    await expect(store.put({ key: 'retry', content: new Uint8Array([1]) })).rejects.toThrow(
      'index unavailable',
    )
    await expect(store.find('retry')).resolves.toBeNull()
    expect(await cas.list()).toHaveLength(1)
    await expect(store.put({ key: 'retry', content: new Uint8Array([1]) })).resolves.toMatchObject({
      created: true,
    })
    expect(await cas.list()).toHaveLength(1)
  })

  it('JSONで表せない値を内容の保存前に拒否する', async () => {
    const { store, cas } = setup(adapter)
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    for (const attributes of [NaN, undefined, new Date(), cycle, [undefined]]) {
      if (attributes === undefined) continue
      await expect(
        store.put({
          key: 'invalid',
          content: new Uint8Array([1]),
          metadata: { attributes: attributes as JsonValue },
        }),
      ).rejects.toThrow()
    }
    await expect(cas.list()).resolves.toEqual([])
  })
})

async function collect(content: AsyncIterable<Uint8Array>): Promise<number[]> {
  const result: number[] = []
  for await (const chunk of content) result.push(...chunk)
  return result
}

async function collectItems<T>(items: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []
  for await (const item of items) result.push(item)
  return result
}
