import { describe, expect, it } from 'vitest'

import * as publicApi from './index'

describe('共通テーブルの公開面', () => {
  it('値の export は利用側と合意した名前だけを持つ', () => {
    // Arrange
    const expectedNames = [
      'DataTable',
      'DataTableView',
      'allCapabilities',
      'createDataTableColumnHelper',
      'createDataTableFactory',
      'rowPinningColumnId',
      'rowSelectionColumnId',
      'useDataTable',
    ]

    // Act
    const exportedNames = Object.keys(publicApi).sort()

    // Assert
    expect(exportedNames).toEqual(expectedNames)
  })

  it('操作列の ID は列の状態（幅・固定・並び）のキーとして使う値を保つ', () => {
    // Act
    const operationColumnIds = [publicApi.rowSelectionColumnId, publicApi.rowPinningColumnId]

    // Assert
    expect(operationColumnIds).toEqual(['__select__', '__pin__'])
  })
})
