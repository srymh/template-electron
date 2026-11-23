import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { createTodoRuntime, createTodoSqliteStorage } from '@repo/todo'
import type { TodoRuntime } from '@repo/todo'
import type { TodoContext } from '@your-app-name/api/todo'

import type { DesktopFeatureFactory } from '../app/feature'

type TodoRuntimeInitOptions = {
  dbPath: string
}

type DesktopTodoRuntime = TodoRuntime<TodoRuntimeInitOptions>

/**
 * window間で共有するTodo runtimeを遅延作成する機能を作成する。
 * @param host - 保存先と終了処理の能力
 * @returns windowごとにserviceの取得窓口を生成する機能
 */
export const createTodoFeature: DesktopFeatureFactory<TodoContext> = ({ appRuntime }) => {
  let sharedRuntime: DesktopTodoRuntime | null = null

  const getService: TodoContext['getService'] = async () => {
    let runtime = sharedRuntime
    if (runtime && runtime.isInitialized()) {
      return runtime.getService()
    }

    if (!runtime) {
      const newRuntime = createDesktopTodoRuntime()
      sharedRuntime = newRuntime
      appRuntime.addDispose(() => newRuntime.dispose())
      runtime = newRuntime
    }

    await runtime.init({
      dbPath: path.join(appRuntime.paths.electronDataPath, 'todo.db'),
    })
    return runtime.getService()
  }

  return {
    createWindowContext: () => ({ getService }),
  }
}

function createDesktopTodoRuntime(): DesktopTodoRuntime {
  return createTodoRuntime<TodoRuntimeInitOptions>({
    createStorage: async ({ dbPath }) => {
      const sqliteDb = new DatabaseSync(dbPath, { timeout: 5000 })

      try {
        return {
          value: await createTodoSqliteStorage(sqliteDb),
          dispose: () => {
            sqliteDb.close()
          },
        }
      } catch (error) {
        sqliteDb.close()
        throw error
      }
    },
  })
}
