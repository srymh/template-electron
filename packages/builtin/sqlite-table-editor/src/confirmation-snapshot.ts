/** confirmation snapshotが期待する一括操作から生成されたことを検証する。 */
export function assertConfirmationSnapshotOperation(
  value: string,
  expected: 'upsert' | 'delete',
): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error(`${expected}用のconfirmation snapshotではありません。`)
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('operation' in parsed) ||
    parsed.operation !== expected
  ) {
    throw new Error(`${expected}用のconfirmation snapshotではありません。`)
  }
}
