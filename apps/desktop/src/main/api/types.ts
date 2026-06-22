import type { BrowserWindow } from 'electron'

import type { AppContext, WindowState } from '../app-context'
import type { AppRuntime } from '../app/app-runtime'

export type CreateApiContextOptions = {
  win: BrowserWindow
  appRuntime: AppRuntime
  appContext: AppContext
  windowState: WindowState
}

export type CreateApiContext<TApiContext> = (options: CreateApiContextOptions) => TApiContext
