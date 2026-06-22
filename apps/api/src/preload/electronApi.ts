import { deepMergeRecord } from '@repo/deep-merge'

import type { ElectronApi } from '../api'
import { electronMainApi } from './electronMainApi'
import { electronRendererApi } from './electronRendererApi'

export const electronApi: ElectronApi = deepMergeRecord(electronMainApi, electronRendererApi)
