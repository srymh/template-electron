import { afterEach, describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

import { createDatabase, runInTransaction } from '@repo/sqlite'
import type { Database } from '@repo/sqlite'
import { openTestDatabase } from '@repo/sqlite/testing'

import { createSQLiteTableEditor } from './index'

const databases: Database[] = []

function setup() {
  const database = openTestDatabase()
  databases.push(database)
  database.exec(`
    CREATE TABLE label (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE item (id INTEGER PRIMARY KEY, label_id INTEGER REFERENCES label(id));
    INSERT INTO label VALUES (1, NULL), (2, '表示名');
    INSERT INTO item VALUES (1, 1), (2, 2);
  `)
  return database
}

function editorFor(database: Database) {
  return createSQLiteTableEditor(database, {
    tableNames: ['item'] as const,
    getConfig: () => ({
      displayName: '項目',
      editableColumns: {
        label_id: {
          referenceOptions: {
            tableName: 'label',
            valueColumn: 'id',
            labelColumn: 'name',
            nullable: true,
          },
        },
      },
      referenceLabels: { label_id: { tableName: 'label', valueColumn: 'id', labelColumn: 'name' } },
    }),
  })
}

// 実際のDB出力へ不正値を注入する。SQLの綴り・空白・クエリの実行順は照合しない。
function transformRows(database: Database, transform: (row: unknown) => unknown) {
  return createDatabase({
    prepare: (sql) => ({
      get: (...params) => transform(database.get(sql, params)),
      all: (...params) => database.query(sql, params).map(transform),
      run: (...params) => database.run(sql, params),
    }),
    exec: (sql) => database.exec(sql),
    close: () => {},
  })
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

describe('SQLite table editorのDB検証', () => {
  it('生成時はSQLを実行せず、初回操作の失敗時も借用接続を閉じない', () => {
    const database = setup()
    const failure = new Error('接続を利用できない')
    let closed = false
    const borrowedDatabase = createDatabase({
      prepare: () => {
        throw failure
      },
      exec: () => {
        throw failure
      },
      close: () => {
        closed = true
      },
    })

    const editor = editorFor(borrowedDatabase)

    expect(() => editor.listTables()).toThrow(failure)
    expect(closed).toBe(false)
    expect(database.get('SELECT COUNT(*) AS total FROM item')).toEqual({ total: 2 })
  })

  it('単行追加の結果変換に失敗したらINSERTもrollbackして元の例外を返す', () => {
    const database = setup()
    const failure = new Error('保存値を変換できない')
    const editor = createSQLiteTableEditor(database, {
      tableNames: ['item'] as const,
      getConfig: () => ({
        displayName: '項目',
        editableColumns: { label_id: null },
        columnCodecs: {
          label_id: {
            parseExternal: () => 1,
            toDatabase: (value) => value,
            fromDatabase: () => {
              throw failure
            },
          },
        },
      }),
    })

    expect(() => editor.createRow({ tableName: 'item', row: { id: 3, label_id: 1 } })).toThrow(
      failure,
    )
    expect(database.get('SELECT * FROM item WHERE id = 3')).toBeUndefined()
  })

  it('高水準の編集はネストを拒否し、外側transactionの変更を取り消さない', () => {
    const database = setup()
    const editor = editorFor(database)

    runInTransaction(database, () => {
      database.run('INSERT INTO item VALUES (3, 1)')
      expect(() => editor.createRow({ tableName: 'item', row: { id: 4, label_id: 1 } })).toThrow()
      expect(database.get('SELECT * FROM item WHERE id = 3')).toEqual({ id: 3, label_id: 1 })
    })

    expect(database.get('SELECT * FROM item WHERE id = 3')).toEqual({ id: 3, label_id: 1 })
    expect(database.get('SELECT * FROM item WHERE id = 4')).toBeUndefined()
  })

  it('列定義に主キーとNULLを選べる参照候補を含める', () => {
    // Arrange
    const editor = editorFor(setup())

    // Act
    const tables = editor.listTables()

    // Assert
    expect(tables[0]).toMatchObject({
      columns: [
        { name: 'id', defaultValue: null, primaryKeyOrder: 1 },
        {
          name: 'label_id',
          primaryKeyOrder: null,
          allowedValueOptions: [
            { value: null, label: null },
            { value: 1, label: null },
            { value: 2, label: '表示名' },
          ],
        },
      ],
    })
  })

  it('行数と各行の参照ラベルを返し、NULLのラベルは保持する', () => {
    // Arrange
    const editor = editorFor(setup())

    // Act
    const result = editor.listRows({ tableName: 'item', range: { type: 'all', maxRows: 10 } })

    // Assert
    expect(result).toMatchObject({
      total: 2,
      rowLabels: [{ label_id: null }, { label_id: '表示名' }],
    })
  })

  it('文字列の件数を上限判定に使わない', () => {
    // Arrange
    const database = transformRows(setup(), (row) =>
      typeof row === 'object' && row !== null && 'total' in row ? { ...row, total: '2' } : row,
    )
    // Act / Assert: 不正なDB出力を例外として拒否する。
    expect(() =>
      editorFor(database).listRows({ tableName: 'item', range: { type: 'all', maxRows: 10 } }),
    ).toThrow(ZodError)
  })

  it('不正なPRAGMAのboolean値をnullable列として扱わない', () => {
    // Arrange
    const database = transformRows(setup(), (row) =>
      typeof row === 'object' && row !== null && 'notNull' in row ? { ...row, notNull: 2 } : row,
    )
    // Act / Assert: 不正なDB出力を例外として拒否する。
    expect(() => editorFor(database).listTables()).toThrow(ZodError)
  })

  it('不正な参照ラベルを公開結果へ返さない', () => {
    // Arrange
    const database = transformRows(setup(), (row) =>
      // 入力候補のvalue/label行は変えず、参照先のlabel行だけを壊す。
      typeof row === 'object' && row !== null && 'label' in row && !('value' in row)
        ? { ...row, label: 123 }
        : row,
    )
    // Act / Assert: 不正なDB出力を例外として拒否する。
    expect(() =>
      editorFor(database).listRows({ tableName: 'item', range: { type: 'all', maxRows: 10 } }),
    ).toThrow(ZodError)
  })
})
