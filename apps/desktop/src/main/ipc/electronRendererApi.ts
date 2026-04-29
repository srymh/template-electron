import { webUtils } from 'electron'

import { createRendererOnlyElectronApi } from '@repo/ipc/browser'

import type { FileSystemRendererApi, FS_API_KEY } from '../api/fs'

type Api = {
  [FS_API_KEY]: FileSystemRendererApi
}

const getPathForFile: FileSystemRendererApi['getPathForFile'] = async (options) =>
  webUtils.getPathForFile(options.file)

export const electronRendererApi = createRendererOnlyElectronApi<Api>(({ defineHelper }) =>
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

export type ElectronRendererApi = typeof electronRendererApi
