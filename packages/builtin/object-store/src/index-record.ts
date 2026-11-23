import type { CreateObjectIndexInput, ObjectIndexRecord } from './index-store'

/** 検証・正規化済みのindexレコードについて、内容参照とmetadataの一致を判定する。 */
export function matchesIndexRecord(
  record: ObjectIndexRecord,
  input: CreateObjectIndexInput,
): boolean {
  return (
    record.sha256 === input.sha256 &&
    record.byteSize === input.byteSize &&
    JSON.stringify(record.metadata) === JSON.stringify(input.metadata)
  )
}
