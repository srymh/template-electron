import { createDataTableFactory } from './create-data-table-factory'

/** 利用側のmetaを持たない既存の表が共有するfactory。 */
export const defaultDataTableFactory = createDataTableFactory<Record<never, never>>()
