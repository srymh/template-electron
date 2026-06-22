import { webUtils } from 'electron'

import { createRendererOnlyElectronApi } from '@repo/ipc/browser'

import type { ElectronRendererApi } from '../api'
import type { FileSystemRendererApi } from '../api/fs'

const getPathForFile: FileSystemRendererApi['getPathForFile'] = async (options) =>
  webUtils.getPathForFile(options.file)

export const electronRendererApi = createRendererOnlyElectronApi<ElectronRendererApi>(
  ({ defineHelper }) =>
    /**
     * defineHelper の使用は任意ですが、以下の利点があります。
     * 1. 型推論を助けるために利用することができます。
     * 2. 誤ったチャネル名を使用した場合に型エラーを発生させることができます。
     */
    defineHelper({
      // 'this.should.cause.a.type.error': () => {},
      fs: {
        getPathForFile,
      },
    }),
)
