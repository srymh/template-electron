import { deepMergeRecord } from '@repo/deep-merge'
import type { DeepMerge } from '@repo/deep-merge'

import { electronMainApi } from './electronMainApi'
import type { ElectronMainApi } from './electronMainApi'
import { electronRendererApi } from './electronRendererApi'
import type { ElectronRendererApi } from './electronRendererApi'

export const electronApi = deepMergeRecord(electronMainApi, electronRendererApi)
export type ElectronApi = DeepMerge<ElectronMainApi, ElectronRendererApi>
