const keyEncoder = new TextEncoder()

/**
 * キーをUTF-8のバイト列として比較する。SQLiteのBINARY照合（UTF-8のDBでのmemcmp）と同じ順序になる。
 * JavaScriptの既定の文字列比較はUTF-16 code unit順で、補助文字とU+E000以降のBMP文字の順序が異なるため使わない。
 * @returns leftが前なら負、後なら正、同じキーなら0
 */
export function compareObjectKeys(left: string, right: string): number {
  const leftBytes = keyEncoder.encode(left)
  const rightBytes = keyEncoder.encode(right)
  const length = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index]! - rightBytes[index]!
  }
  return leftBytes.length - rightBytes.length
}
