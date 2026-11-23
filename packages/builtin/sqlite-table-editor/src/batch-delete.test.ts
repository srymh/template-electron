import { afterEach, describe, expect, it } from 'vitest'

import type { Database } from '@repo/sqlite'
import { openTestDatabase } from '@repo/sqlite/testing'

import { createItemEditor } from './item-editor.fixture'

const databases: Database[] = []

function setup() {
  const database = openTestDatabase()
  databases.push(database)
  const editor = createItemEditor(database)
  return { database, editor }
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

describe('SQLite table editor batch delete', () => {
  it('削除対象の差分を返し、previewでは保存行を変更しない', () => {
    // Arrange
    const { database, editor } = setup()
    database.run('INSERT INTO label (label_id, name) VALUES (?, ?)', [1, '分類'])
    database.run('INSERT INTO item (item_id, label_id, name) VALUES (?, ?, ?)', [1, 1, 'A'])
    database.run('INSERT INTO item (item_id, label_id, name) VALUES (?, ?, ?)', [2, 1, 'B'])

    // Act
    const preview = editor.previewBatchDelete({
      tableName: 'item',
      keys: [{ item_id: 1 }, { item_id: 2 }],
    })

    // Assert
    expect(preview.summary).toEqual({
      total: 2,
      add: 0,
      update: 0,
      unchanged: 0,
      remove: 2,
      error: 0,
    })
    expect(preview.items[0]).toMatchObject({
      status: 'remove',
      key: { item_id: 1 },
      before: { item_id: 1, label_id: 1, name: 'A', note: '' },
    })
    expect(database.query('SELECT item_id FROM item ORDER BY item_id')).toEqual([
      { item_id: 1 },
      { item_id: 2 },
    ])
  })

  it('確認済みの対象行だけを削除する', () => {
    // Arrange
    const { database, editor } = setup()
    database.exec(`
      INSERT INTO label VALUES (1, '分類');
      INSERT INTO item (item_id, label_id, name) VALUES (1, 1, 'A'), (2, 1, 'B'), (3, 1, '保持');
    `)
    const input = { tableName: 'item' as const, keys: [{ item_id: 1 }, { item_id: 2 }] }
    const preview = editor.previewBatchDelete(input)

    // Act
    const result = editor.applyBatchDelete({
      ...input,
      confirmationSnapshot: preview.confirmationSnapshot!,
    })
    const remainingRows = database.query('SELECT item_id FROM item')

    // Assert
    expect(result).toEqual({ tableName: 'item', removed: 2 })
    expect(remainingRows).toEqual([{ item_id: 3 }])
  })

  it.each([
    ['存在しない行', [{ item_id: 2 }]],
    ['重複主キー', [{ item_id: 1 }, { item_id: 1 }]],
    ['主キー以外の値', [{ item_id: 1, name: 'X' }]],
  ])('%sを含む削除は適用不可にする', (_condition, keys) => {
    // Arrange
    const { database, editor } = setup()
    database.exec(`
      INSERT INTO label VALUES (1, '分類');
      INSERT INTO item (item_id, label_id, name) VALUES (1, 1, 'A');
    `)

    // Act
    const preview = editor.previewBatchDelete({ tableName: 'item', keys })

    // Assert
    expect(preview.applicable).toBe(false)
    expect(preview.summary.error).toBe(keys.length)
    expect(preview.confirmationSnapshot).toBeNull()
  })

  it('preview後に対象行が変化した場合は削除しない', () => {
    // Arrange
    const { database, editor } = setup()
    database.run('INSERT INTO label (label_id, name) VALUES (?, ?)', [1, '分類'])
    database.run('INSERT INTO item (item_id, label_id, name) VALUES (?, ?, ?)', [1, 1, 'A'])
    const input = { tableName: 'item' as const, keys: [{ item_id: 1 }] }
    const preview = editor.previewBatchDelete(input)
    database.run('UPDATE item SET name = ? WHERE item_id = ?', ['外部更新', 1])

    // Act / Assert: 例外を捕捉するため、throw matcherで操作する。
    expect(() =>
      editor.applyBatchDelete({
        ...input,
        confirmationSnapshot: preview.confirmationSnapshot!,
      }),
    ).toThrow('差分を再確認')
    expect(database.get('SELECT name FROM item WHERE item_id = 1')).toEqual({ name: '外部更新' })
  })
})
