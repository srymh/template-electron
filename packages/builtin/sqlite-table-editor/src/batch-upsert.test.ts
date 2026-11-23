import { afterEach, describe, expect, it } from 'vitest'

import type { Database } from '@repo/sqlite'
import { openTestDatabase } from '@repo/sqlite/testing'

import { applySQLiteTableBatchUpsert } from './batch-upsert'
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

describe('SQLite table editor batch upsert', () => {
  it('既存行では省略列を維持し、変更前後のreference labelを返す', () => {
    // Arrange
    const { database, editor } = setup()
    database.run('INSERT INTO label (label_id, name) VALUES (?, ?)', [1, '変更前'])
    database.run('INSERT INTO label (label_id, name) VALUES (?, ?)', [2, '変更後'])
    database.run('INSERT INTO item (item_id, label_id, name) VALUES (?, ?, ?)', [1, 1, '項目'])

    // Act
    const preview = editor.previewBatchUpsert({
      tableName: 'item',
      rows: [{ item_id: 1, label_id: 2 }],
    })

    // Assert
    expect(preview.items[0]).toMatchObject({
      status: 'update',
      before: { item_id: 1, label_id: 1, name: '項目', note: '' },
      beforeLabels: { label_id: '変更前' },
      after: { item_id: 1, label_id: 2, name: '項目', note: '' },
      afterLabels: { label_id: '変更後' },
    })
  })

  it('新規行で既定値のない必須列を省略した場合は拒否する', () => {
    // Arrange
    const { database, editor } = setup()
    database.run('INSERT INTO label (label_id, name) VALUES (?, ?)', [1, '分類'])

    // Act
    const preview = editor.previewBatchUpsert({
      tableName: 'item',
      rows: [{ item_id: 1, label_id: 1 }],
    })

    // Assert
    expect(preview.items[0]).toMatchObject({
      status: 'error',
      errors: ['新規行に必須のカラムを指定してください: name'],
    })
  })

  it('新規行で既定値のある列を省略して適用すると既定値を保存する', () => {
    // Arrange
    const { database, editor } = setup()
    database.run('INSERT INTO label (label_id, name) VALUES (?, ?)', [1, '分類'])
    const input = {
      tableName: 'item' as const,
      rows: [{ item_id: 1, label_id: 1, name: '項目' }],
    }
    const preview = editor.previewBatchUpsert(input)

    // Act
    const result = editor.applyBatchUpsert({
      ...input,
      confirmationSnapshot: preview.confirmationSnapshot!,
    })
    const savedRow = database.get('SELECT * FROM item WHERE item_id = 1')

    // Assert
    expect(result).toEqual({ tableName: 'item', added: 1, updated: 0 })
    expect(savedRow).toEqual({ item_id: 1, label_id: 1, name: '項目', note: '' })
  })

  it('metadata由来の複合UNIQUE制約について重複した全行をエラーにする', () => {
    // Arrange
    const { database, editor } = setup()
    database.run('INSERT INTO label (label_id, name) VALUES (?, ?)', [1, '分類'])

    // Act
    const preview = editor.previewBatchUpsert({
      tableName: 'item',
      rows: [
        { item_id: 1, label_id: 1, name: '重複' },
        { item_id: 2, label_id: 1, name: '重複' },
      ],
    })

    // Assert
    expect(preview.summary.error).toBe(2)
    expect(
      preview.items.every(({ errors }) => errors.some((error) => error.includes('一意制約'))),
    ).toBe(true)
  })

  it('既存行で省略された列を現在値で補って複合UNIQUE重複を検出する', () => {
    // Arrange
    const { database, editor } = setup()
    database.run('INSERT INTO label (label_id, name) VALUES (?, ?)', [1, '分類'])
    database.run('INSERT INTO item (item_id, label_id, name) VALUES (?, ?, ?)', [1, 1, 'A'])
    database.run('INSERT INTO item (item_id, label_id, name) VALUES (?, ?, ?)', [2, 1, 'B'])

    // Act
    const preview = editor.previewBatchUpsert({
      tableName: 'item',
      rows: [
        { item_id: 1, name: '重複' },
        { item_id: 2, name: '重複' },
      ],
    })

    // Assert
    expect(preview.summary.error).toBe(2)
    expect(
      preview.items.every(({ errors }) => errors.some((error) => error.includes('一意制約'))),
    ).toBe(true)
  })
})

it('本適用中の行書き込みが失敗したら、先行行もrollbackして元の例外を伝える', () => {
  // Arrange: 汎用table editorの書き込み能力で障害を作り、SQL文字列や試行回数に依存しない。
  const { database, editor } = setup()
  database.run('INSERT INTO label (label_id, name) VALUES (?, ?)', [1, '分類'])
  const input = {
    tableName: 'item' as const,
    rows: [
      { item_id: 1, label_id: 1, name: 'A' },
      { item_id: 2, label_id: 1, name: 'B' },
    ],
  }
  const preview = editor.previewBatchUpsert(input)
  const prepared = editor.prepareTable('item')
  const failure = new Error('second row failed')
  let savepointDepth = 0
  let firstRowAtFailure: unknown
  const exec = database.exec.bind(database)
  // previewの試し書きはsavepoint内。本適用との区別だけを接続境界で観測する。
  database.exec = (sql) => {
    exec(sql)
    const command = sql.trim().split(/\s+/u)[0]?.toUpperCase()
    if (command === 'SAVEPOINT') savepointDepth++
    if (command === 'RELEASE') savepointDepth--
  }
  const failingTable = {
    ...prepared,
    createRowInTransaction: (row: Parameters<typeof prepared.createRowInTransaction>[0]) => {
      if (row.item_id === 2 && savepointDepth === 0) {
        firstRowAtFailure = database.get('SELECT item_id FROM item WHERE item_id = 1')
        throw failure
      }
      return prepared.createRowInTransaction(row)
    },
  }

  // Act / Assert
  expect(() =>
    applySQLiteTableBatchUpsert(database, failingTable, {
      ...input,
      confirmationSnapshot: preview.confirmationSnapshot!,
    }),
  ).toThrow(failure)
  const remainingRows = database.query('SELECT * FROM item')
  expect(firstRowAtFailure).toEqual({ item_id: 1 })
  expect(remainingRows).toEqual([])
})
