import path from 'node:path'
import { fileURLToPath } from 'node:url'

type Platform = typeof process.platform

export function resolveAppProtocolFilePath(
  requestUrl: string,
  platform: Platform = process.platform,
): string {
  const url = new URL(requestUrl)
  if (url.protocol !== 'app:') {
    throw new Error(`Unsupported protocol: ${url.protocol}`)
  }

  if (platform === 'win32' && url.pathname.startsWith('//')) {
    return path.win32.normalize(
      `\\\\${decodeURIComponent(url.pathname.slice(2)).replaceAll('/', '\\')}`,
    )
  }

  const fileUrl = new URL(`file:${requestUrl.slice('app:'.length)}`)

  if (platform === 'win32') {
    return path.win32.normalize(fileURLToPath(fileUrl, { windows: true }))
  }

  return path.posix.normalize(fileURLToPath(fileUrl, { windows: false }))
}
