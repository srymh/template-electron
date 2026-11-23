import { createTodoService } from './service'
import type { CreateTodoServiceOptions, TodoService } from './service'
import type { TodoStorage } from './storage'

export type TodoRuntime<TInitOptions> = {
  init: (options: TInitOptions) => Promise<void>
  isInitialized: () => boolean
  dispose: () => Promise<void>
  getService: () => TodoService
}

export type TodoRuntimeResource<T> = {
  value: T
  dispose?: () => void | Promise<void>
}

export type CreateTodoRuntimeOptions<TInitOptions> = Omit<CreateTodoServiceOptions, 'storage'> & {
  createStorage: (
    options: TInitOptions,
  ) => TodoRuntimeResource<TodoStorage> | Promise<TodoRuntimeResource<TodoStorage>>
}

function createRuntimeError(message: string): Error {
  return new Error(`TodoRuntime ${message}`)
}

export function createTodoRuntime<TInitOptions>(
  options: CreateTodoRuntimeOptions<TInitOptions>,
): TodoRuntime<TInitOptions> {
  let initialized = false
  let disposed = false
  let service: TodoService | null = null
  let disposeStorage: (() => void | Promise<void>) | null = null
  let initPromise: Promise<void> | null = null

  const init = async (initOptions: TInitOptions): Promise<void> => {
    if (disposed) {
      throw createRuntimeError('is disposed')
    }

    if (initialized) {
      return
    }

    if (initPromise) {
      return initPromise
    }

    initPromise = (async () => {
      const storageResource = await options.createStorage(initOptions)

      if (disposed) {
        await storageResource.dispose?.()
        throw createRuntimeError('is disposed')
      }

      service = createTodoService({
        storage: storageResource.value,
        now: options.now,
        randomUUID: options.randomUUID,
      })
      disposeStorage = storageResource.dispose ?? null
      initialized = true
    })()

    try {
      await initPromise
    } finally {
      initPromise = null
    }
  }

  const dispose = async (): Promise<void> => {
    if (disposed) {
      return
    }

    disposed = true

    if (initPromise) {
      await initPromise.catch(() => undefined)
    }

    const disposeCurrentStorage = disposeStorage
    initialized = false
    service = null
    disposeStorage = null

    await disposeCurrentStorage?.()
  }

  const getService = (): TodoService => {
    if (disposed) {
      throw createRuntimeError('is disposed')
    }

    if (!service) {
      throw createRuntimeError('is not initialized')
    }

    return service
  }

  return {
    init,
    isInitialized: () => initialized,
    dispose,
    getService,
  }
}
