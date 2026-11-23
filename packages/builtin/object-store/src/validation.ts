import type { JsonValue, ObjectListRange, ObjectMetadata, ObjectMetadataInput } from './contracts'
import type { CreateObjectIndexInput, ObjectIndexRecord } from './index-store'

const keyEncoder = new TextEncoder()

/** UTF-8で1〜1024バイトのキーを検証し、大小文字・空白・Unicodeを正規化せず保持する。 */
export function validateKey(key: string): string {
  if (
    typeof key !== 'string' ||
    key.length === 0 ||
    keyEncoder.encode(key).byteLength > 1024 ||
    /\p{Cc}/u.test(key) ||
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(key)
  ) {
    throw new TypeError(
      'Object keyは制御文字と不正なサロゲートを含まない1〜1024 UTF-8バイトの文字列で指定してください。',
    )
  }
  if (
    key.includes('\\') ||
    key.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new TypeError(
      'Object keyにはバックスラッシュ、空のセグメント、単独の「.」「..」セグメントを指定できません。',
    )
  }
  return key
}

/** 取得範囲を検証して複製する。offsetは0以上、limitは1以上の安全な整数に限る。 */
export function validateListRange(range: ObjectListRange): ObjectListRange {
  const { offset, limit } = range ?? {}
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1) {
    throw new RangeError('取得範囲はoffsetを0以上、limitを1以上の整数で指定してください。')
  }
  return { offset, limit }
}

export function validateRevision(revision: string): string {
  if (
    typeof revision !== 'string' ||
    revision.length === 0 ||
    revision.length > 256 ||
    revision.includes('\0')
  ) {
    throw new TypeError('revisionには保存結果の不透明な更新tokenを指定してください。')
  }
  return revision
}

/** JSONの属性順に依存せず比較・保存できるよう、検証しながら複製する。 */
export function cloneJson(value: unknown, ancestors = new Set<object>()): JsonValue {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return typeof value === 'number' && value === 0 ? 0 : value
  if (typeof value !== 'object' || ancestors.has(value))
    throw new TypeError('attributesは循環参照のないJSON値で指定してください。')
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
    throw new TypeError('attributesはJSON値で指定してください。')
  if (Object.getOwnPropertySymbols(value).length > 0)
    throw new TypeError('attributesにSymbolは保存できません。')
  ancestors.add(value)
  const result: JsonValue = Array.isArray(value)
    ? Array.from(value, (child) => cloneJson(child, ancestors))
    : Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([key, child]) => [key, cloneJson(child, ancestors)]),
      )
  ancestors.delete(value)
  return result
}

export function normalizeMetadata(input: ObjectMetadataInput = {}): ObjectMetadata {
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('metadataはオブジェクトで指定してください。')
  let mediaType = input.mediaType ?? null
  if (mediaType !== null) {
    if (typeof mediaType !== 'string') throw new TypeError('mediaTypeが不正です。')
    mediaType = mediaType.trim().toLowerCase()
    if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mediaType))
      throw new TypeError('mediaTypeはtype/subtype形式で指定してください。')
  }
  const fileName = input.fileName ?? null
  if (
    fileName !== null &&
    (typeof fileName !== 'string' ||
      fileName.length === 0 ||
      fileName.length > 1024 ||
      fileName.includes('\0'))
  )
    throw new TypeError('fileNameが不正です。')
  return {
    mediaType,
    fileName,
    attributes: cloneJson(input.attributes === undefined ? null : input.attributes),
  }
}

/** 永続化境界でレコードの形式とmetadataを検証し、参照の共有を防ぐ。 */
export function validateIndexInput(record: CreateObjectIndexInput): CreateObjectIndexInput {
  if (
    !/^[0-9a-f]{64}$/.test(record.sha256) ||
    !Number.isSafeInteger(record.byteSize) ||
    record.byteSize < 0
  )
    throw new TypeError('Object indexの内容参照が不正です。')
  return {
    key: validateKey(record.key),
    sha256: record.sha256,
    byteSize: record.byteSize,
    metadata: normalizeMetadata(record.metadata),
  }
}

/** adapterの発行方式を解釈せず、永続化レコードの更新tokenを検証する。 */
export function validateIndexRecord(record: ObjectIndexRecord): ObjectIndexRecord {
  return { ...validateIndexInput(record), revision: validateRevision(record.revision) }
}
