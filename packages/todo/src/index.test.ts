import { describe, expect, it } from 'vitest'

import {
  createTodoService,
  TodoItemSchema,
  createTodoSqliteStorage,
  createTodoMemoryStorage,
  createTodoRuntime,
} from '.'

function createFixedDeps() {
  let idCounter = 0
  let timeCounter = 0

  return {
    randomUUID: () => {
      idCounter += 1
      return `todo-${idCounter}`
    },
    now: () => {
      timeCounter += 1
      return `2026-03-03T00:00:0${timeCounter}.000Z`
    },
  }
}

describe('todo lib', () => {
  it('creates, lists, gets, updates, toggles, deletes (memory)', async () => {
    const deps = createFixedDeps()
    const storage = createTodoMemoryStorage()
    const todo = createTodoService({ storage, ...deps })

    const created = await todo.create({ title: 'A', description: 'desc' })
    expect(created).toMatchObject({
      id: 'todo-1',
      title: 'A',
      description: 'desc',
      completed: false,
      createdAt: '2026-03-03T00:00:01.000Z',
      updatedAt: '2026-03-03T00:00:01.000Z',
    })
    expect(TodoItemSchema.safeParse(created).success).toBe(true)

    const created2 = await todo.create({ title: 'B' })
    expect(created2.id).toBe('todo-2')

    const list1 = await todo.list()
    expect(list1.map((t) => t.id)).toEqual(['todo-1', 'todo-2'])

    const got = await todo.get('todo-1')
    expect(got?.title).toBe('A')

    const updated = await todo.update('todo-1', { title: 'A2' })
    expect(updated).toMatchObject({
      id: 'todo-1',
      title: 'A2',
      completed: false,
      createdAt: '2026-03-03T00:00:01.000Z',
      updatedAt: '2026-03-03T00:00:03.000Z',
    })

    const toggled = await todo.setCompleted('todo-1', true)
    expect(toggled).toMatchObject({
      id: 'todo-1',
      completed: true,
      updatedAt: '2026-03-03T00:00:04.000Z',
    })

    await todo.remove('todo-2')
    const list2 = await todo.list()
    expect(list2.map((t) => t.id)).toEqual(['todo-1'])
  })

  it('validates title constraints', async () => {
    const deps = createFixedDeps()
    const storage = createTodoMemoryStorage()
    const todo = createTodoService({ storage, ...deps })

    await expect(todo.create({ title: '' })).rejects.toThrow(/タイトルは必須です/)

    const tooLong = 'a'.repeat(64)
    await expect(todo.create({ title: tooLong })).rejects.toThrow(/タイトルは63文字以内/)
  })

  it('returns null when missing', async () => {
    const deps = createFixedDeps()
    const storage = createTodoMemoryStorage()
    const todo = createTodoService({ storage, ...deps })

    const got = await todo.get('missing')
    expect(got).toBeNull()
  })

  it('persists with sqlite storage', async () => {
    const deps = createFixedDeps()
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(':memory:')
    try {
      const storage = await createTodoSqliteStorage(db)
      const todo = createTodoService({ storage, ...deps })

      const created = await todo.create({ title: 'A' })
      const list = await todo.list()
      expect(list.map((t) => t.id)).toEqual([created.id])

      const got = await todo.get(created.id)
      expect(got).toMatchObject({
        id: created.id,
        title: 'A',
        completed: false,
      })

      const updated = await todo.update(created.id, { description: 'x' })
      expect(updated.description).toBe('x')
      expect(updated.updatedAt).toBe('2026-03-03T00:00:02.000Z')
    } finally {
      db.close()
    }
  })

  it('creates a runtime from injected storage and disposes the owned resource', async () => {
    const deps = createFixedDeps()
    let disposed = false

    const runtime = createTodoRuntime<{ label: string }>({
      ...deps,
      createStorage: ({ label }) => ({
        value: createTodoMemoryStorage(),
        dispose: () => {
          disposed = label === 'memory'
        },
      }),
    })

    expect(runtime.isInitialized()).toBe(false)
    expect(() => runtime.getService()).toThrow('TodoRuntime is not initialized')

    await runtime.init({ label: 'memory' })

    expect(runtime.isInitialized()).toBe(true)
    const created = await runtime.getService().create({ title: 'Runtime' })
    expect(created).toMatchObject({
      id: 'todo-1',
      title: 'Runtime',
    })

    await runtime.dispose()

    expect(disposed).toBe(true)
    expect(runtime.isInitialized()).toBe(false)
    expect(() => runtime.getService()).toThrow('TodoRuntime is disposed')
  })
})
