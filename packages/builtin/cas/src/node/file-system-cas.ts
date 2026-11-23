import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import path from 'node:path'

import type { Cas, CasObject, CasPutOptions, CasPutResult } from '../index'
import { assertCasReadRange } from '../read-range'
import { validateByteSize } from '../validation'

const sha256Pattern = /^[0-9a-f]{64}$/

/** filesystem固有のpath解決を追加したNode.js向けCAS adapter。 */
export type FileSystemCas = Cas & {
  resolvePath: (sha256: string) => string
}

/** バイト列のSHA-256 digestをlowercase hexで返す。 */
export function hashCasContent(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * extensionless CAS objectの保存先を解決する。
 *
 * `{root}/sha256/{sha256[0:2]}/{sha256}`という配置を使用する。
 */
export function resolveCasObjectPath(root: string, sha256: string): string {
  assertSha256(sha256)
  return path.join(root, 'sha256', sha256.slice(0, 2), sha256)
}

/** extensionless objectを保存するNode.js filesystem CAS adapterを作成する。 */
export function createFileSystemCas(root: string): FileSystemCas {
  const resolvedRoot = path.resolve(root)

  const resolvePath = (sha256: string) => resolveCasObjectPath(resolvedRoot, sha256)

  const read: Cas['read'] = async (sha256) => {
    const content = await fs.readFile(resolvePath(sha256))
    return new Uint8Array(content)
  }

  const readStream: Cas['readStream'] = async (sha256, range) => {
    const filePath = resolvePath(sha256)
    const [rootRealPath, fileRealPath] = await Promise.all([
      fs.realpath(resolvedRoot),
      fs.realpath(filePath),
    ])
    const relativeFromRoot = path.relative(rootRealPath, fileRealPath)
    if (
      relativeFromRoot === '..' ||
      relativeFromRoot.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeFromRoot)
    ) {
      throw new Error(`CAS objectが保存root外を参照しています: ${sha256}`)
    }
    const stats = await fs.stat(fileRealPath)
    if (!stats.isFile()) throw new Error(`CAS objectがファイルではありません: ${sha256}`)
    assertCasReadRange(range, stats.size)
    const offset = range?.offset ?? 0
    const length = range?.length ?? stats.size
    return {
      byteSize: stats.size,
      content:
        length === 0
          ? singleChunkStream(new Uint8Array())
          : readFileChunks(fileRealPath, offset, length),
    }
  }

  const verify: Cas['verify'] = async (sha256) => {
    assertSha256(sha256)

    const hash = createHash('sha256')
    let byteSize = 0
    try {
      for await (const chunk of createReadStream(resolvePath(sha256))) {
        if (!(chunk instanceof Uint8Array)) {
          throw new Error('CAS object streamから不正な値を読み込みました。')
        }
        byteSize += chunk.byteLength
        if (!Number.isSafeInteger(byteSize)) {
          throw new Error('CAS objectのbyte sizeが安全に表現できる範囲を超えました。')
        }
        hash.update(chunk)
      }
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return { status: 'missing' }
      throw error
    }

    const actualSha256 = hash.digest('hex')
    const object = { sha256, byteSize }
    return actualSha256 === sha256
      ? { status: 'valid', ...object }
      : { status: 'corrupt', ...object, actualSha256 }
  }

  const putStream: Cas['putStream'] = async (content, putOptions) => {
    const validatedPutOptions = validatePutOptions(putOptions)
    const temporaryDirectory = path.join(resolvedRoot, '.tmp')
    await fs.mkdir(temporaryDirectory, { recursive: true })
    const temporaryPath = path.join(temporaryDirectory, randomUUID())

    let handle: FileHandle | undefined
    try {
      handle = await fs.open(temporaryPath, 'wx')
      const hash = createHash('sha256')
      let byteSize = 0

      for await (const chunk of content) {
        if (!(chunk instanceof Uint8Array)) {
          throw new Error('CAS streamはUint8Arrayの反復として指定してください。')
        }
        if (chunk.byteLength === 0) continue

        byteSize += chunk.byteLength
        if (!Number.isSafeInteger(byteSize)) {
          throw new Error('CAS objectのbyte sizeが安全に表現できる範囲を超えました。')
        }
        hash.update(chunk)
        await writeAll(handle, chunk)
      }

      await handle.sync()
      await handle.close()
      handle = undefined

      if (
        validatedPutOptions?.expectedByteSize !== undefined &&
        validatedPutOptions.expectedByteSize !== byteSize
      ) {
        throw new Error(
          `CAS objectの実測byte sizeが期待値と一致しません（期待値: ${validatedPutOptions.expectedByteSize}、実測値: ${byteSize}）。`,
        )
      }

      const sha256 = hash.digest('hex')
      const destinationPath = resolvePath(sha256)
      const existing = await verify(sha256)
      let result: CasPutResult
      if (existing.status === 'valid') {
        result = { sha256, byteSize, created: false }
      } else if (existing.status === 'corrupt') {
        throw new Error(`CAS objectの内容がdigestと一致しません: ${sha256}`)
      } else {
        await fs.mkdir(path.dirname(destinationPath), { recursive: true })
        let created = true
        try {
          // 同時保存で既存objectを上書きしないよう、同一volume内で排他的に確定する。
          await fs.link(temporaryPath, destinationPath)
        } catch (error) {
          // 並行保存先が先に確定した場合は、既存objectを検証して成功扱いにする。
          const concurrent = await verify(sha256)
          if (concurrent.status !== 'valid') throw error
          created = false
        }
        result = { sha256, byteSize, created }
      }

      return result
    } finally {
      // cleanup失敗で本来の保存結果・例外を上書きしない。
      await handle?.close().catch(() => undefined)
      await fs.unlink(temporaryPath).catch(() => undefined)
    }
  }

  const put: Cas['put'] = async (content, putOptions) =>
    putStream(singleChunkStream(content), putOptions)

  const exists: Cas['exists'] = async (sha256) => {
    try {
      const stat = await fs.stat(resolvePath(sha256))
      return stat.isFile()
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return false
      throw error
    }
  }

  const list: Cas['list'] = async () => {
    const algorithmRoot = path.join(resolvedRoot, 'sha256')
    let prefixEntries
    try {
      prefixEntries = await fs.readdir(algorithmRoot, { withFileTypes: true })
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return []
      throw error
    }

    const objects: CasObject[] = []
    for (const prefixEntry of prefixEntries) {
      if (!prefixEntry.isDirectory() || !/^[0-9a-f]{2}$/.test(prefixEntry.name)) continue

      const prefixPath = path.join(algorithmRoot, prefixEntry.name)
      const objectEntries = await fs.readdir(prefixPath, { withFileTypes: true })
      for (const objectEntry of objectEntries) {
        const sha256 = objectEntry.name
        if (!objectEntry.isFile() || !sha256Pattern.test(sha256)) continue
        if (!sha256.startsWith(prefixEntry.name)) continue

        try {
          const stat = await fs.stat(path.join(prefixPath, sha256))
          objects.push({ sha256, byteSize: stat.size })
        } catch (error) {
          // 列挙中に別操作がobjectを削除した場合は、次回診断へ委ねる。
          if (!isNodeError(error, 'ENOENT')) throw error
        }
      }
    }

    return objects.sort((left, right) => left.sha256.localeCompare(right.sha256))
  }

  const remove: Cas['remove'] = async (sha256) => {
    try {
      await fs.unlink(resolvePath(sha256))
    } catch (error) {
      if (!isNodeError(error, 'ENOENT')) throw error
    }
  }

  return {
    put,
    putStream,
    read,
    readStream,
    list,
    exists,
    verify,
    remove,
    resolvePath,
  }
}

function validatePutOptions(options: CasPutOptions | undefined): CasPutOptions | undefined {
  if (!options) return undefined
  return options.expectedByteSize === undefined
    ? {}
    : { expectedByteSize: validateByteSize(options.expectedByteSize) }
}

async function* singleChunkStream(content: Uint8Array): AsyncIterable<Uint8Array> {
  yield content
}

async function* readFileChunks(
  filePath: string,
  offset: number,
  length: number,
): AsyncIterable<Uint8Array> {
  yield* createReadStream(filePath, { start: offset, end: offset + length - 1 })
}

async function writeAll(handle: FileHandle, content: Uint8Array): Promise<void> {
  let offset = 0
  while (offset < content.byteLength) {
    const { bytesWritten } = await handle.write(content, offset, content.byteLength - offset)
    if (bytesWritten === 0) throw new Error('CAS一時ファイルへ書き込めませんでした。')
    offset += bytesWritten
  }
}

function assertSha256(sha256: string): void {
  if (!sha256Pattern.test(sha256)) {
    throw new Error(`不正なSHA-256 digestです: ${sha256}`)
  }
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code
}
