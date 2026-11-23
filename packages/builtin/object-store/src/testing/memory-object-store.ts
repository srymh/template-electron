import { createMemoryCas } from '@repo/cas/testing'

import type { ObjectStore } from '../contracts'
import { createObjectStore } from '../object-store'
import { createMemoryObjectIndex } from './memory-object-index'

/**
 * メモリ上の本文とキーindexを接続したObject Storeを作成する。
 * @returns 呼び出しごとに独立した保存状態を持つ、空のObject Store
 */
export function createMemoryObjectStore(): ObjectStore {
  return createObjectStore({ cas: createMemoryCas(), index: createMemoryObjectIndex() })
}
