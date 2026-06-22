import type { WebContext } from '@your-app-name/api/web'

import type { CreateApiContext } from './types'

export const createWebContext: CreateApiContext<WebContext> = ({ win }) => {
  return {
    getWebContents: () => win.webContents,
  }
}
