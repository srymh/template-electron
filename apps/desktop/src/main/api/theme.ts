import type { ThemeContext } from '@your-app-name/api/theme'

import type { CreateApiContext } from './types'

export const createThemeContext: CreateApiContext<ThemeContext> = ({ win }) => {
  return {
    setTitleBarOverlay: (options) => {
      if (process.platform === 'darwin') return
      win.setTitleBarOverlay(options)
    },
  }
}
