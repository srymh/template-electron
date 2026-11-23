import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createMemoryCas } from '@repo/cas/testing'
import type { Database } from '@repo/sqlite'
import { openTestDatabase } from '@repo/sqlite/testing'

import { createObjectStore } from '../index'
import { createSqliteObjectIndex } from './index'

const cleanups: Array<() => Promise<void> | void> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

/** 閉じ忘れを防ぐため、開いた接続をテスト後に閉じる。 */
function openDatabase(filePath?: string) {
  const database = openTestDatabase(filePath)
  cleanups.push(() => database.close())
  return database
}

async function createTempDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'object-store-sqlite-'))
  cleanups.push(() => fs.rm(directory, { recursive: true, force: true }))
  return directory
}

/** queryが返した行数を記録する。adapterがJavaScriptへ渡した行だけを数える。 */
function countQueriedRows(database: Database) {
  const queriedRowCounts: number[] = []
  const query = database.query.bind(database)
  database.query = ((sql: string, params?: readonly unknown[]) => {
    const rows = query(sql, params)
    queriedRowCounts.push(rows.length)
    return rows
  }) as Database['query']
  return queriedRowCounts
}

describe('範囲取得', () => {
  it('範囲より前の行をJavaScriptへ取得せず、範囲内の行だけを受け取る', async () => {
    // Arrange
    const database = openDatabase()
    const store = createObjectStore({
      cas: createMemoryCas(),
      index: createSqliteObjectIndex(database),
    })
    for (let index = 0; index < 250; index += 1) {
      await store.put({ key: `k/${String(index).padStart(3, '0')}`, content: new Uint8Array([1]) })
    }
    const queriedRowCounts = countQueriedRows(database)

    // Act
    const listed = await store.listRange({ offset: 200, limit: 10 })

    // Assert
    expect(listed.map(({ key }) => key)).toEqual(
      Array.from({ length: 10 }, (_, index) => `k/${String(200 + index).padStart(3, '0')}`),
    )
    expect(queriedRowCounts).toEqual([10])
  })
})

describe('DBの文字エンコーディング', () => {
  it('UTF-8の新規DBでは作成でき、閉じて開き直した既存DBも使用できる', async () => {
    // Arrange
    const filePath = path.join(await createTempDirectory(), 'index.db')
    const created = openTestDatabase(filePath)
    await createObjectStore({
      cas: createMemoryCas(),
      index: createSqliteObjectIndex(created),
    }).put({ key: 'a', content: new Uint8Array([1]) })
    created.close()
    const reopened = openDatabase(filePath)

    // Act
    const index = createSqliteObjectIndex(reopened)
    const found = await index.find('a')

    // Assert
    expect(found).toMatchObject({ key: 'a' })
  })

  it('UTF-16の新規DBは、schemaを作成せずに拒否する', () => {
    // Arrange: テーブル作成前のDBにだけencodingを指定できるため、接続直後に指定する。
    const database = openDatabase()
    database.exec(`PRAGMA encoding = 'UTF-16le'`)

    // Act / Assert
    expect(() => createSqliteObjectIndex(database)).toThrow('UTF-8')
    expect(database.get(`SELECT 1 FROM sqlite_master WHERE name = 'object_store_schema'`)).toBe(
      undefined,
    )
  })

  it('UTF-16で作成済みの既存DBは拒否する', async () => {
    // Arrange: UTF-16のDBにテーブルを作ってencodingを確定させ、閉じてから開き直す。
    const filePath = path.join(await createTempDirectory(), 'index.db')
    const created = openTestDatabase(filePath)
    created.exec(`PRAGMA encoding = 'UTF-16le'`)
    created.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY)')
    created.close()
    const reopened = openDatabase(filePath)

    // Act / Assert
    expect(() => createSqliteObjectIndex(reopened)).toThrow('UTF-8')
  })
})
