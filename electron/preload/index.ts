import { contextBridge } from 'electron'
import { electronApi } from '../main/ipc/electronApi'

contextBridge.exposeInMainWorld('electronApi', electronApi)
