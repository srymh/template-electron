import type { ThemeContext } from '@your-app-name/api/theme'

import type { DesktopFeatureFactory } from '../app/feature'

/**
 * 対象windowのタイトルバーを操作する機能を作成する。
 * @returns windowごとにタイトルバーの操作窓口を生成する機能
 */
export const createThemeFeature: DesktopFeatureFactory<ThemeContext> = () => ({
  createWindowContext: ({ win }) => ({
    setTitleBarOverlay: (options) => {
      if (process.platform === 'darwin') return
      win.setTitleBarOverlay(options)
    },
  }),
})
