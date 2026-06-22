import { deepMergeRecord } from '@repo/deep-merge'

import { electronMainApi } from './electronMainApi'
import { electronRendererApi } from './electronRendererApi'

export const electronApi = deepMergeRecord(electronMainApi, electronRendererApi)
export type ElectronApi = typeof electronApi
