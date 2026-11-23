import { describe, expect, it, vi } from 'vitest'

import { createMemoryCas } from '@repo/cas/testing'

import { createObjectStore } from './index'
import { createMemoryObjectIndex } from './testing'

async function setup() {
  const cas = createMemoryCas()
  const store = createObjectStore({ cas, index: createMemoryObjectIndex() })
  const saved = await store.put({
    key: 'stream',
    content: new Uint8Array([1, 2, 3, 4]),
    metadata: { fileName: 'original' },
  })
  return { cas, store, saved }
}

describe('読み取りstreamの取得サイズ', () => {
  it.each([
    { range: undefined, chunks: [[1, 2, 3]], label: '全量の不足' },
    {
      range: undefined,
      chunks: [
        [1, 2],
        [3, 4, 5],
      ],
      label: '全量の超過',
    },
    { range: { offset: 1, length: 2 }, chunks: [[2]], label: '部分取得の不足' },
    { range: { offset: 1, length: 2 }, chunks: [[2], [3, 4]], label: '部分取得の超過' },
    { range: { offset: 4, length: 0 }, chunks: [[9]], label: 'ゼロ長の超過' },
  ])('$labelをiterator消費時に検出する', async ({ range, chunks }) => {
    const { cas, store } = await setup()
    vi.spyOn(cas, 'readStream').mockResolvedValue({ byteSize: 4, content: chunksOf(chunks) })
    const stream = await store.readStream('stream', range)
    await expect(collect(stream.content)).rejects.toMatchObject({
      code: 'corrupt-content',
      key: 'stream',
    })
  })

  it('超過を含むchunkを利用側へ渡さず、消費を打ち切る', async () => {
    const { cas, store } = await setup()
    const closed = vi.fn()
    vi.spyOn(cas, 'readStream').mockResolvedValue({
      byteSize: 4,
      content: (async function* () {
        try {
          yield new Uint8Array([1, 2])
          yield new Uint8Array([3, 4, 5])
        } finally {
          closed()
        }
      })(),
    })
    const stream = await store.readStream('stream')
    const iterator = stream.content[Symbol.asyncIterator]()
    await expect(iterator.next()).resolves.toMatchObject({
      value: new Uint8Array([1, 2]),
      done: false,
    })
    await expect(iterator.next()).rejects.toMatchObject({ code: 'corrupt-content' })
    expect(closed).toHaveBeenCalledOnce()
  })

  it('利用側の途中キャンセルを不足扱いせず、元のiteratorを閉じる', async () => {
    const { cas, store } = await setup()
    const closed = vi.fn()
    vi.spyOn(cas, 'readStream').mockResolvedValue({
      byteSize: 4,
      content: (async function* () {
        try {
          yield new Uint8Array([1])
          yield new Uint8Array([2, 3, 4])
        } finally {
          closed()
        }
      })(),
    })
    const stream = await store.readStream('stream')
    for await (const chunk of stream.content) {
      expect(chunk).toEqual(new Uint8Array([1]))
      break
    }
    expect(closed).toHaveBeenCalledOnce()
  })

  it('途中のI/O例外をサイズ不足のエラーで上書きしない', async () => {
    const { cas, store } = await setup()
    const failure = new Error('source unavailable')
    vi.spyOn(cas, 'readStream').mockResolvedValue({
      byteSize: 4,
      content: (async function* () {
        yield new Uint8Array([1])
        throw failure
      })(),
    })
    const stream = await store.readStream('stream')
    await expect(collect(stream.content)).rejects.toBe(failure)
  })

  it('await中に入力の範囲が変更されても開始時点の要求を保持する', async () => {
    const { store } = await setup()
    const range = { offset: 1, length: 2 }
    const pending = store.readStream('stream', range)
    range.length = 1
    const stream = await pending
    expect(await collect(stream.content)).toEqual([2, 3])
  })

  it('metadata更新・削除・再作成後も取得済みrecordと内容を返す', async () => {
    const { store, saved } = await setup()
    const stream = await store.readStream('stream')
    await store.updateMetadata({
      key: 'stream',
      expectedRevision: saved.object.revision,
      metadata: { fileName: 'updated' },
    })
    await store.remove('stream')
    await store.put({
      key: 'stream',
      content: new Uint8Array([9]),
      metadata: { fileName: 'recreated' },
    })
    expect(stream.object).toEqual(saved.object)
    expect(await collect(stream.content)).toEqual([1, 2, 3, 4])
    await expect(store.read('stream')).resolves.toEqual(new Uint8Array([9]))
  })

  it('EOFのゼロ長取得は成功し、不正な範囲は拒否する', async () => {
    const { store } = await setup()
    const empty = await store.readStream('stream', { offset: 4, length: 0 })
    expect(await collect(empty.content)).toEqual([])
    for (const range of [
      { offset: -1, length: 1 },
      { offset: 0.5, length: 1 },
      { offset: 0, length: -1 },
      { offset: 0, length: 0.5 },
      { offset: 5, length: 0 },
      { offset: 4, length: 1 },
    ]) {
      await expect(store.readStream('stream', range)).rejects.toThrow(RangeError)
    }
  })
})

async function* chunksOf(chunks: number[][]): AsyncIterable<Uint8Array> {
  for (const chunk of chunks) yield new Uint8Array(chunk)
}

async function collect(content: AsyncIterable<Uint8Array>): Promise<number[]> {
  const result: number[] = []
  for await (const chunk of content) result.push(...chunk)
  return result
}
