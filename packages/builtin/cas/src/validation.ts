/** 期待するbyte sizeを、安全に表現できる非負整数に限定する。 */
export function validateByteSize(byteSize: number): number {
  if (!Number.isSafeInteger(byteSize) || byteSize < 0) {
    throw new RangeError('CAS objectのbyte sizeは0以上の安全な整数で指定してください。')
  }
  return byteSize
}
