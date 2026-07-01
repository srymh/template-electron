import { describe, expect, it } from 'vitest'

import { formatBytes } from './format-bytes'

describe('formatBytes', () => {
  // -----------------------------------------------------------------------------------------------
  // バイト数を適切な単位にフォーマットすることを確認する
  // -----------------------------------------------------------------------------------------------
  it.each([
    { size: 512, expected: '512 B' },
    { size: 1024, expected: '1.0 KB' },
    { size: 1536, expected: '1.5 KB' },
    { size: 10 * 1024, expected: '10 KB' },
    { size: 1024 * 1024, expected: '1.0 MB' },
  ])('formats $size bytes as $expected', ({ size, expected }) => {
    expect(formatBytes(size)).toBe(expected)
  })
})
