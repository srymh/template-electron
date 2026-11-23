import { protocol } from 'electron'

import { handleAppAssetProtocol } from '@repo/asset-protocol'
import type { AppAssetRootRegistry, AppAssetProtocolHandlerOptions } from '@repo/asset-protocol'

export function registerCustomProtocol(
  appAssetRoots: AppAssetRootRegistry,
  options: AppAssetProtocolHandlerOptions = {},
) {
  protocol.handle('app-asset', (request) => handleAppAssetProtocol(request, appAssetRoots, options))
}

/** app readyより前にstream可能な安全な標準schemeとして登録する。 */
export function registerCustomProtocolPrivileges() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app-asset',
      privileges: {
        standard: true, // http のような標準的な URL scheme として扱わせる。相対 URL 解決などにも関係
        secure: true, // Chromium に secure scheme として扱わせる
        supportFetchAPI: true, // fetch API をサポートする
        corsEnabled: true, // この scheme を CORS の仕組みの対象にする
        stream: true, // <video> / <audio> などでストリーミングレスポンスとして扱えるようにする
      },
    },
  ])
}
