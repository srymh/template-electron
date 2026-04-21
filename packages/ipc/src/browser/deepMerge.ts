type IsDeepMergeTarget<T> =
  T extends Record<string, unknown>
    ? T extends (...args: any[]) => any
      ? false
      : T extends readonly unknown[]
        ? false
        : true
    : false

type DeepMerge<A, B> = {
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

// 以下はメモ
// type MergeObjects<L, R> = {
//   [K in keyof L | keyof R]: K extends keyof R
//     ? K extends keyof L
//       ? Merge<L[K], R[K]>
//       : R[K]
//     : K extends keyof L
//       ? L[K]
//       : never
// }

// type AnyFn = (...args: any[]) => any

// type Join<P extends string, K extends PropertyKey> = P extends ''
//   ? `${Extract<K, string>}`
//   : `${P}.${Extract<K, string>}`

// type ConflictPaths<L, R, P extends string = ''> =
//   // 右が関数：上書き（左が何であれログ対象）
//   R extends AnyFn
//     ? L extends undefined
//       ? never
//       : P
//     : L extends AnyFn
//       ? R extends object
//         ? P
//         : never // 関数→オブジェクトも衝突
//       : L extends object
//         ? R extends object
//           ? {
//               [K in keyof L | keyof R]: K extends keyof L
//                 ? K extends keyof R
//                   ? ConflictPaths<L[K], R[K], Join<P, K>>
//                   : never
//                 : never
//             }[keyof L | keyof R]
//           : never
//         : never

// type AssertNoConflicts<L, R> =
//   ConflictPaths<L, R> extends never
//     ? unknown
//     : { __conflicts__: ConflictPaths<L, R> }

// export type Merge<L, R> =
//   // 右が関数ならそれが勝つ
//   R extends AnyFn
//     ? R
//     : // 左が関数で右がオブジェクトなら右
//       L extends AnyFn
//       ? R extends object
//         ? Merge<{}, R>
//         : R
//       : // 両方オブジェクトなら再帰
//         L extends object
//         ? R extends object
//           ? MergeObjects<L, R>
//           : R
//         : R

// /**
//  * 制約付き deep merge:
//  * - 枝: オブジェクト
//  * - 葉: 関数
//  * - 後勝ち
//  * - 関数が絡む上書きはログ
//  */
// export function mergeArrowTree<L, R>(
//   left: L,
//   right: R,
//   opts?: { warn?: (msg: string, meta?: unknown) => void },
// ): Merge<L, R> {
//   const warn = opts?.warn ?? ((msg, meta) => console.warn(msg, meta))

//   const rec = (l: any, r: any, path: string[]): any => {
//     const keyPath = path.length ? path.join('.') : '<root>'

//     const lIsFn = typeof l === 'function'
//     const rIsFn = typeof r === 'function'
//     const lIsObj = isPlainObject(l)
//     const rIsObj = isPlainObject(r)

//     // 🔔 関数が絡む衝突（function<->function, object<->function）を全部ログ
//     if (l !== undefined && r !== undefined && (lIsFn || rIsFn)) {
//       warn(`[mergeArrowTree] overwrite at "${keyPath}"`, { from: l, to: r })
//     }

//     // 右が関数なら後勝ち
//     if (rIsFn) return r

//     // 関数→オブジェクト（枝に置換）
//     if (rIsObj && lIsFn) return rec({}, r, path)

//     // 枝同士
//     if (lIsObj && rIsObj) {
//       const out: Record<string, unknown> = { ...l }
//       for (const [k, rv] of Object.entries(r)) {
//         out[k] = rec((l as any)[k], rv, [...path, k])
//       }
//       return out
//     }

//     return r === undefined ? l : r
//   }

//   return rec(left, right, []) as Merge<L, R>
// }

// export function mergeArrowTreeStrict<L, R>(
//   left: L & AssertNoConflicts<L, R>,
//   right: R,
// ): Merge<L, R> {
//   return mergeArrowTree(left, right) as any
// }

// /**
//  * オブジェクトかどうか
//  * @param v 判定対象
//  * @returns オブジェクトであれば true
//  */
// function isPlainObject(v: unknown): v is Record<string, unknown> {
//   return (
//     v !== null && // null でない
//     typeof v === 'object' && // オブジェクト型である
//     !Array.isArray(v) // 配列でない
//   )
// }
// describe('deepMerge2', () => {
//   it('mergeArrowTree はオブジェクトをマージできる', () => {
//     const left = {
//       a: () => 1,
//       b: () => 2,
//     }

//     const right = {
//       c: () => 3,
//       d: {
//         d1: () => 4,
//         d2: () => 5,
//       },
//     }

//     const merged = mergeArrowTree(left, right)
//     expect(merged).toHaveProperty('a')
//     expect(merged).toHaveProperty('b')
//     expect(merged).toHaveProperty('c')
//     expect(merged).toHaveProperty('d.d1')
//     expect(merged).toHaveProperty('d.d2')
//     expect(merged.a()).toBe(1)
//     expect(merged.b()).toBe(2)
//     expect(merged.c()).toBe(3)
//     expect(merged.d.d1()).toBe(4)
//     expect(merged.d.d2()).toBe(5)
//   })

//   it('mergeArrowTree はキーが一致するオブジェクトを後勝ちでマージできる', () => {
//     const left = {
//       a: () => 1,
//       b: () => 2,
//     }

//     const right = {
//       a: () => 10,
//       c: () => 3,
//       d: {
//         d1: () => 4,
//         d2: () => 5,
//       },
//     }

//     const merged = mergeArrowTree(left, right)
//     expect(merged).toHaveProperty('a')
//     expect(merged).toHaveProperty('b')
//     expect(merged).toHaveProperty('c')
//     expect(merged).toHaveProperty('d.d1')
//     expect(merged).toHaveProperty('d.d2')
//     // 後勝ち
//     expect(merged.a()).toBe(10)
//     expect(merged.b()).toBe(2)
//     expect(merged.c()).toBe(3)
//     expect(merged.d.d1()).toBe(4)
//     expect(merged.d.d2()).toBe(5)
//   })

//   it('mergeArrowTreeStrict はオブジェクトをマージできる', () => {
//     const left = {
//       a: () => 1,
//       b: () => 2,
//     }

//     const right = {
//       c: () => 3,
//       d: {
//         d1: () => 4,
//         d2: () => 5,
//       },
//     }

//     const merged = mergeArrowTreeStrict(left, right)
//     expect(merged).toHaveProperty('a')
//     expect(merged).toHaveProperty('b')
//     expect(merged).toHaveProperty('c')
//     expect(merged).toHaveProperty('d.d1')
//     expect(merged).toHaveProperty('d.d2')
//     expect(merged.a()).toBe(1)
//     expect(merged.b()).toBe(2)
//     expect(merged.c()).toBe(3)
//     expect(merged.d.d1()).toBe(4)
//     expect(merged.d.d2()).toBe(5)
//   })

//   it('mergeArrowTreeStrict はキーが一致するオブジェクトを後勝ちでマージできるが、警告を出すべき', () => {
//     const left = {
//       a: () => 1,
//       b: () => 2,
//     }

//     const right = {
//       a: () => 10,
//       c: () => 3,
//       d: {
//         d1: () => 4,
//         d2: () => 5,
//       },
//     }

//     // @ts-expect-error キーがコンフリクトしている場合mergeArrowTreeStrictは警告を出すべき
//     const merged = mergeArrowTreeStrict(left, right)
//     expect(merged).toHaveProperty('a')
//     expect(merged).toHaveProperty('b')
//     expect(merged).toHaveProperty('c')
//     expect(merged).toHaveProperty('d.d1')
//     expect(merged).toHaveProperty('d.d2')
//     // 後勝ち
//     expect(merged.a()).toBe(10)
//     expect(merged.b()).toBe(2)
//     expect(merged.c()).toBe(3)
//     expect(merged.d.d1()).toBe(4)
//     expect(merged.d.d2()).toBe(5)
//   })
// })
