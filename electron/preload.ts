import { contextBridge } from 'electron'
import { electronApi } from './ipc/electronApi'

contextBridge.exposeInMainWorld('electronApi', electronApi)
