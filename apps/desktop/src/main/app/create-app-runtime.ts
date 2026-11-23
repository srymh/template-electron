import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { app } from 'electron'

import { Logger } from '../infra/logger'
import type { MainPaths } from '../infra/paths'
import { ensureTrailingSeparator, resolveMainPaths } from '../infra/paths'
import { SecretStorage } from '../infra/safe-storage'
import { ensureDirectory } from '../utils/ensure-directory'
import { AppRuntime } from './app-runtime'

export async function createAppRuntime({
  dirname,
  devServerUrl,
}: {
  dirname: string
  devServerUrl?: string
}): Promise<AppRuntime> {
  const paths = resolveMainPaths({
    isPackaged: app.isPackaged,
    dirname,
    homePath: app.getPath('home'),
  })

  // app-data/ 以下は各機能の runtime が遅延初期化時に作成する。
  await ensureDirectory(paths.electronDataPath)
  const secretsDir = path.join(paths.electronDataPath, 'secrets')
  await ensureDirectory(secretsDir)

  const appRuntime = new AppRuntime({
    paths,
    devServerUrl: devServerUrl ?? null,
    allowedDevOrigin: getAllowedDevOrigin(devServerUrl),
    rendererRootUrl: getRendererRootUrl(paths),
    logger: new Logger(path.join(paths.electronDataPath, 'log.txt'), !app.isPackaged),
    secretStorage: new SecretStorage(secretsDir),
  })

  // ここで logger の dispose を登録すると一番最初に logger が dispose される。
  // その他の登録した dispose 関数で logger を使えなくなる。
  // そのため、 appRuntime 側で最後に logger を dispose するようにしている。
  // appRuntime.addDispose(() => appRuntime.logger.dispose())

  return appRuntime
}

function getRendererRootUrl(paths: MainPaths) {
  return paths.rendererDist
    ? pathToFileURL(ensureTrailingSeparator(paths.rendererDist)).toString()
    : null
}

function getAllowedDevOrigin(devServerUrl?: string) {
  if (!devServerUrl) return null
  try {
    return new URL(devServerUrl).origin
  } catch {
    return null
  }
}
