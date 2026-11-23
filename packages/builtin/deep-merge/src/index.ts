type IsDeepMergeTarget<T> =
  T extends Record<string, unknown>
    ? T extends (...args: any[]) => any
      ? false
      : T extends readonly unknown[]
        ? false
        : true
    : false

export type DeepMerge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? K extends keyof A
      ? IsDeepMergeTarget<A[K]> extends true
        ? IsDeepMergeTarget<B[K]> extends true
          ? DeepMerge<A[K], B[K]>
          : B[K]
        : B[K]
      : B[K]
    : K extends keyof A
      ? A[K]
      : never
}

/**
 * 値がプレーンなオブジェクトかどうかを判定する
 * @param value 判定する値
 * @returns プレーンなオブジェクトであれば true、そうでなければ false
 */
const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  // オブジェクトでない場合は false
  if (typeof value !== 'object' || value === null) return false

  // 配列は除外
  if (Array.isArray(value)) return false

  // オブジェクトリテラルまたは Object.create(null) で作成されたオブジェクトのみ許可
  const proto = Object.getPrototypeOf(value)
  return (
    proto === Object.prototype || // オブジェクトリテラル {}
    proto === null // Object.create(null) で作成されたオブジェクト
  )
}

/**
 * 深いマージを行う
 * @param left マージ対象のオブジェクト
 * @param right マージ対象のオブジェクト
 * @returns マージ結果
 */
export const deepMergeRecord = <
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
>(
  left: TLeft,
  right: TRight,
): DeepMerge<TLeft, TRight> => {
  // コピーを作成
  const result: Record<string, unknown> = { ...left }

  // right の各キーを処理
  for (const [key, rightValue] of Object.entries(right)) {
    // left の値を取得
    const leftValue = left[key]

    if (isPlainRecord(leftValue) && isPlainRecord(rightValue)) {
      // 両方ともオブジェクトなら再帰的にマージ
      result[key] = deepMergeRecord(leftValue, rightValue)
    } else {
      // それ以外は right の値で上書き
      result[key] = rightValue
    }
  }

  return result as DeepMerge<TLeft, TRight>
}
