import { createTableHookContexts } from '@tanstack/react-table'

import type { ComponentRowData, DataTableFeatures } from './features'

/**
 * factoryの機能型に結び付けた、表・見出し・セルのコンテキストを作る。
 * @returns 同じfactoryの部品とAppTableで共有するコンテキストと読取フック
 */
export function createDataTableContexts<TMeta extends object>() {
  return createTableHookContexts<DataTableFeatures<TMeta>, ComponentRowData>()
}

/** factory内の部品が共有する、機能型に対応したコンテキスト。 */
export type DataTableContexts<TMeta extends object> = ReturnType<
  typeof createDataTableContexts<TMeta>
>
