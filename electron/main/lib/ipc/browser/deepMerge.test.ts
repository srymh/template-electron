import { describe, it, expect } from 'vitest'
import { deepMergeRecord } from './deepMerge'

describe('deepMerge', () => {
  it('deepMergeRecord はオブジェクトをマージできる', () => {
    const left = {
      a: () => 1,
      b: () => 2,
    }

    const right = {
      c: () => 3,
      d: {
        d1: () => 4,
        d2: () => 5,
      },
    }

    const merged = deepMergeRecord(left, right)
    expect(merged).toHaveProperty('a')
    expect(merged).toHaveProperty('b')
    expect(merged).toHaveProperty('c')
    expect(merged).toHaveProperty('d.d1')
    expect(merged).toHaveProperty('d.d2')
    expect(merged.a()).toBe(1)
    expect(merged.b()).toBe(2)
    expect(merged.c()).toBe(3)
    expect(merged.d.d1()).toBe(4)
    expect(merged.d.d2()).toBe(5)
  })

  it('deepMergeRecord はキーが一致するオブジェクトを後勝ちでマージできる', () => {
    const left = {
      a: () => 1,
      b: () => 2,
    }

    const right = {
      a: () => 10,
      c: () => 3,
      d: {
        d1: () => 4,
        d2: () => 5,
      },
    }

    const merged = deepMergeRecord(left, right)
    expect(merged).toHaveProperty('a')
    expect(merged).toHaveProperty('b')
    expect(merged).toHaveProperty('c')
    expect(merged).toHaveProperty('d.d1')
    expect(merged).toHaveProperty('d.d2')
    // 後勝ち
    expect(merged.a()).toBe(10)
    expect(merged.b()).toBe(2)
    expect(merged.c()).toBe(3)
    expect(merged.d.d1()).toBe(4)
    expect(merged.d.d2()).toBe(5)
  })
})
