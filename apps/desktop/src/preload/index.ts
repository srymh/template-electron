import { contextBridge } from 'electron'

import { electronApi } from '@your-app-name/api/preload'

contextBridge.exposeInMainWorld('api', electronApi)
