import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { resolveAppAssetProtocolTarget } from './app-asset-url'
import type { AppAssetRootRegistry } from './root-registry'

export type AppAssetProtocolErrorContext = {
  requestUrl: string
  rootId: string
  relativePath: string
}

export type AppAssetProtocolHandlerOptions = {
  onInternalError?: (error: unknown, context: AppAssetProtocolErrorContext) => void
}

/**
 * app-asset:// protocolのハンドラ
 */
export async function handleAppAssetProtocol(
  request: Request,
  registry: AppAssetRootRegistry,
  options: AppAssetProtocolHandlerOptions = {},
): Promise<Response> {
  // GET/HEAD以外を拒否
  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let target: ReturnType<typeof resolveAppAssetProtocolTarget>
  try {
    target = resolveAppAssetProtocolTarget(request.url, registry)
  } catch {
    return createNotFoundResponse()
  }

  const { relativePath, root } = target
  try {
    let byteSize: number
    let contentType: string
    let read: (offset: number, length: number) => Promise<AsyncIterable<Uint8Array>>

    if (root.resolution === 'stream') {
      const resolved = await root.resolveStream(relativePath, target.searchParams)
      if (!resolved) return createNotFoundResponse()
      byteSize = resolved.byteSize
      if (!Number.isSafeInteger(byteSize) || byteSize < 0) {
        throw new Error(`Invalid asset byte size: ${byteSize}`)
      }
      contentType = normalizeMediaType(resolved.mediaType)
      read = (offset, length) => resolved.read({ offset, length })
    } else {
      const resolvedFile = await root.resolveFile(relativePath, target.searchParams)
      if (!resolvedFile) return createNotFoundResponse()
      try {
        const readableFilePath = await resolveReadableFilePath(root.basePath, resolvedFile.filePath)
        const stats = await fs.stat(readableFilePath)
        if (!stats.isFile()) throw new Error(`Asset path is not a file: ${readableFilePath}`)
        byteSize = stats.size
        contentType = resolvedFile.mediaType
          ? normalizeMediaType(resolvedFile.mediaType)
          : getContentType(readableFilePath)
        read = async (offset, length) =>
          createReadStream(readableFilePath, { start: offset, end: offset + length - 1 })
      } catch {
        return createNotFoundResponse()
      }
    }

    const range = parseByteRange(request.headers.get('range'), byteSize)
    if (range === 'unsatisfiable') {
      return new Response(null, {
        status: 416,
        headers: createAssetHeaders(contentType, root.cacheControl, 0, {
          contentRange: `bytes */${byteSize}`,
        }),
      })
    }

    const start = range?.start ?? 0
    const end = range?.end ?? Math.max(0, byteSize - 1)
    const contentLength = byteSize === 0 ? 0 : end - start + 1
    const headers = createAssetHeaders(contentType, root.cacheControl, contentLength, {
      contentRange: range ? `bytes ${start}-${end}/${byteSize}` : undefined,
    })
    const status = range ? 206 : 200

    if (request.method.toUpperCase() === 'HEAD') {
      return new Response(null, { status, headers })
    }

    if (byteSize === 0) return new Response(null, { status, headers })

    const body = createIterableBody(await read(start, contentLength), contentLength)
    return new Response(body, { status, headers })
  } catch (error) {
    if (root.resolution === 'directory') return createNotFoundResponse()
    options.onInternalError?.(error, {
      requestUrl: request.url,
      rootId: root.id,
      relativePath,
    })
    return new Response('Internal Server Error', { status: 500 })
  }
}

function createNotFoundResponse(): Response {
  return new Response('Not Found', { status: 404 })
}

function createIterableBody(
  source: AsyncIterable<Uint8Array>,
  expectedLength: number,
): ReadableStream<Uint8Array> {
  const iterator = source[Symbol.asyncIterator]()
  let emitted = 0

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next()
        if (done) {
          if (emitted !== expectedLength) {
            throw new Error('Asset stream ended before the declared byte size')
          }
          controller.close()
          return
        }
        if (!(value instanceof Uint8Array)) throw new Error('Asset stream returned invalid data')
        if (value.byteLength > expectedLength - emitted) {
          throw new Error('Asset stream exceeded the declared byte size')
        }

        // Bufferの共有backing storeをResponseへ持ち越さないよう、現在のchunkだけをコピーする。
        const chunk = new Uint8Array(value.byteLength)
        chunk.set(value)
        emitted += chunk.byteLength
        controller.enqueue(chunk)
      } catch (error) {
        try {
          await iterator.return?.()
        } catch {
          // 元の読み取りエラーをResponseへ伝える。
        }
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })
}

/**
 * 読み込み直前に root と対象ファイルの実体パスを解決し、対象が root 配下に収まることを確認する。
 *
 * app-asset resolverは対象を文字列上root配下へ解決するが、途中にsymlinkがある場合、
 * 実体としては root 外のファイルを指す可能性がある。ここでは `fs.realpath` 後のパス同士で再チェックし、
 * symlink 経由の root escape を拒否する。
 */
async function resolveReadableFilePath(rootBasePath: string, filePath: string): Promise<string> {
  const [rootRealPath, fileRealPath] = await Promise.all([
    fs.realpath(rootBasePath),
    fs.realpath(filePath),
  ])
  const relativeFromRoot = path.relative(rootRealPath, fileRealPath)

  if (
    relativeFromRoot === '..' ||
    relativeFromRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeFromRoot)
  ) {
    throw new Error(`Asset path escapes root: ${filePath}`)
  }

  return fileRealPath
}

/**
 * app-asset:// protocolのレスポンスヘッダを作成する
 * @param contentType Content-Type
 * @param cacheControl Cache-Control
 * @returns HeadersInit
 */
function createAssetHeaders(
  contentType: string,
  cacheControl: string,
  contentLength: number,
  options: { contentRange?: string } = {},
): HeadersInit {
  // メモ: 'Access-Control-Allow-Origin': '*' は fetch の成否に影響を与えない
  // protocol.registerSchemesAsPrivileged({ privileges: { corsEnabled: true, ... } }) であれば、
  // ACAO に関係なく fetch は成功する。一方、corsEnabled が false の場合には fetch は失敗する。
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'Content-Length': String(contentLength),
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  }
  if (options.contentRange) headers['Content-Range'] = options.contentRange
  return headers
}

type ByteRange = { start: number; end: number }

function parseByteRange(
  value: string | null,
  byteSize: number,
): ByteRange | 'unsatisfiable' | null {
  if (!value) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim())
  if (!match || byteSize === 0) return 'unsatisfiable'

  const [, startText, endText] = match
  if (!startText && !endText) return 'unsatisfiable'

  if (!startText) {
    const suffixLength = Number(endText)
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return 'unsatisfiable'
    return { start: Math.max(0, byteSize - suffixLength), end: byteSize - 1 }
  }

  const start = Number(startText)
  const requestedEnd = endText ? Number(endText) : byteSize - 1
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= byteSize
  ) {
    return 'unsatisfiable'
  }
  return { start, end: Math.min(requestedEnd, byteSize - 1) }
}

function normalizeMediaType(mediaType: string): string {
  const normalized = mediaType.trim().toLowerCase()
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)) {
    throw new Error(`Invalid asset media type: ${mediaType}`)
  }
  return normalized
}

/**
 * ファイルパスからContent-Typeを返す
 * @param filePath ファイルパス
 * @returns Content-Type
 */
function getContentType(filePath: string): string {
  // 拡張子に応じてContent-Typeを返す
  // 参考: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types#image_types

  switch (path.extname(filePath).toLowerCase()) {
    case '.apng':
      return 'image/apng'
    case '.avif':
      return 'image/avif'
    case '.gif':
      return 'image/gif'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}
