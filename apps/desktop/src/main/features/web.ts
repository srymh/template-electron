import type { WebContext } from '@your-app-name/api/web'

import type { DesktopFeatureFactory } from '../app/feature'

/**
 * 対象windowのWebContentsを渡す機能を作成する。
 * @returns windowごとにWebContentsの取得窓口を生成する機能
 */
export const createWebFeature: DesktopFeatureFactory<WebContext> = () => ({
  createWindowContext: ({ win }) => ({
    getWebContents: () => win.webContents,
  }),
})
