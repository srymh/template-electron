import { describe, expect, it } from 'vitest'

import { getColumnDropPointerX, getColumnDropPosition } from './column-drop-position'

// 幅 100 の列 a・b・c・d が x = 0 から並ぶ
const columns = ['a', 'b', 'c', 'd'].map((id, index) => ({
  id,
  left: index * 100,
  right: (index + 1) * 100,
}))

describe('getColumnDropPosition', () => {
  it('他の列の中央を越えるまでは前に、越えると後ろに入れる', () => {
    // Act
    const beforeCenter = getColumnDropPosition(columns, 'a', 249)
    const afterCenter = getColumnDropPosition(columns, 'a', 251)

    // Assert
    // a を除いた並び b・c・d で、c（200〜300）の中央は 250
    expect(beforeCenter).toEqual({ fromIndex: 0, toIndex: 1, boundaryX: 200 })
    expect(afterCenter).toEqual({ fromIndex: 0, toIndex: 2, boundaryX: 300 })
  })

  it('領域の外のポインターは近い方の端に入れ、末尾の境界は最後の列の右端にする', () => {
    // Act
    const beforeStart = getColumnDropPosition(columns, 'c', -50)
    const afterEnd = getColumnDropPosition(columns, 'b', 1000)

    // Assert
    expect(beforeStart).toEqual({ fromIndex: 2, toIndex: 0, boundaryX: 0 })
    expect(afterEnd).toEqual({ fromIndex: 1, toIndex: 3, boundaryX: 400 })
  })

  it('元の位置の上では、移動前と同じ位置を返す', () => {
    // Act
    const position = getColumnDropPosition(columns, 'b', 150)

    // Assert
    expect(position).toEqual({ fromIndex: 1, toIndex: 1, boundaryX: 200 })
  })

  it('ドラッグ中の列が領域にない場合と、他の列がない場合は移動先を返さない', () => {
    // Act
    const missing = getColumnDropPosition(columns, 'x', 150)
    const alone = getColumnDropPosition([columns[0]!], 'a', 150)

    // Assert
    expect(missing).toBeUndefined()
    expect(alone).toBeUndefined()
  })
})

describe('getColumnDropPointerX', () => {
  it('返した座標から求めた移動先が、指定した位置になる', () => {
    // Act
    const positions = [-1, 0, 1, 2, 3, 4].map((toIndex) => {
      const x = getColumnDropPointerX(columns, 'b', toIndex)!
      return getColumnDropPosition(columns, 'b', x)?.toIndex
    })

    // Assert
    // 範囲外の位置は端に寄せる
    expect(positions).toEqual([0, 0, 1, 2, 3, 3])
  })

  it('他の列がない場合は座標を返さない', () => {
    // Act
    const x = getColumnDropPointerX([columns[0]!], 'a', 0)

    // Assert
    expect(x).toBeUndefined()
  })
})
