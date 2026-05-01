export type AsyncQueue<T> = {
  push: (value: T) => void
  close: () => void
  error: (err: unknown) => void
  shift: () => Promise<T | undefined> // undefined = closed & drained
}

export function createAsyncQueue<T>(): AsyncQueue<T> {
  const values: Array<T> = []
  const waiters: Array<(v: T | undefined) => void> = []
  let closed = false
  let failure: unknown | undefined

  const push = (value: T) => {
    if (closed) return
    const w = waiters.shift()
    if (w) w(value)
    else values.push(value)
  }

  const close = () => {
    if (closed) return
    closed = true
    while (waiters.length) waiters.shift()?.(undefined)
  }

  const error = (err: unknown) => {
    failure = err
    close()
  }

  const shift = async (): Promise<T | undefined> => {
    if (failure) throw failure
    const v = values.shift()
    if (v !== undefined) return v
    if (closed) return undefined
    return await new Promise<T | undefined>((resolve) => {
      waiters.push(resolve)
    })
  }

  return { push, close, error, shift }
}
