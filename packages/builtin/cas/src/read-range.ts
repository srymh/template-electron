import type { CasReadRange } from './index'

/** CAS読み取り範囲の境界を、実際のobjectサイズに対して検証する。 */
export function assertCasReadRange(range: CasReadRange | undefined, byteSize: number): void {
  if (!range) return
  const { offset, length } = range
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset > byteSize ||
    length > byteSize - offset
  ) {
    throw new RangeError('CAS読み取り範囲が不正です。')
  }
}
