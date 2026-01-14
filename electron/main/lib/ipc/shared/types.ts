import type { WebContents } from 'electron'

// -----------------------------------------------------------------------------
// Main, Renderer Process 共通部分

export type Api = Record<string, unknown>

export type ApiInterface<T extends Api> = T

export type RemoveListener = () => void

export type Listener<TArg extends any = any> = (arg: TArg) => void

export type AddListener<TArg extends any = any> = (
  listener: Listener<TArg>,
) => RemoveListener

/**
 * 任意の関数型
 */
export type AnyFunction = (...args: any[]) => any

/**
 * 文字列の既知のキーのみを抽出します。
 *
 * string index signature を持つオブジェクトの場合、`never` になります。
 *
 * @example
 * type Test1 = KnownStringKeys<{
 *   a: number
 *   b: string
 * }>
 * // "a" | "b"
 *
 * type Test2 = KnownStringKeys<{
 *   [key: string]: number
 * }>
 * // never
 */
export type KnownStringKeys<T> = {
  [K in keyof T & string]: string extends K ? never : K
}[keyof T & string]

/**
 * 再帰の対象にしてよい「プレーンなオブジェクト」かどうか。
 *
 * - 関数/配列は葉として扱う（ここに再帰すると keyof が肥大化し、最終的に `string` に潰れて型安全が落ちる）
 * - string index signature を持つオブジェクトも葉として扱う（`keyof` が `string` になりやすいため）
 *
 * @example
 * type Test1 = IsRecursableObject<{
 *   a: number
 *   b: {
 *     c: string
 *   }
 * }>
 * // true
 *
 * type Test2 = IsRecursableObject<() => void>
 * // false
 *
 * type Test3 = IsRecursableObject<string[]>
 * // false
 *
 * type Test4 = IsRecursableObject<{
 *   [key: string]: number
 * }>
 * // false
 */
export type IsRecursableObject<T> = T extends Api
  ? T extends AnyFunction
    ? false
    : T extends readonly unknown[]
      ? false
      : KnownStringKeys<T> extends never
        ? false
        : true
  : false

/**
 * 再帰的なキーの型を生成します。
 *
 * @note 関数/配列/index signature を持つオブジェクトには再帰しません。
 *
 * @example
 * type ExampleType = {
 *   a: {
 *     a1: () => number
 *     a2: (arg: number) => void
 *   }
 *   b: {
 *     b1: () => boolean
 *     b2: () => string[]
 *   }
 *   c: () => string
 * }
 *
 * type Result = RecursiveMethodKeys<ExampleType>
 * // => 'a.a1' | 'a.a2' | 'b.b1' | 'b.b2' | 'c'
 */
export type RecursiveMethodKeys<T> = T extends Api
  ? {
      [K in KnownStringKeys<T>]: IsRecursableObject<T[K]> extends true
        ? `${K}.${RecursiveMethodKeys<T[K]>}`
        : `${K}`
    }[KnownStringKeys<T>]
  : never

/**
 * 指定されたパスに対応する型を取得します。
 *
 * @example
 * type ExampleType = {
 *   a: {
 *     a1: () => number
 *     a2: (arg: number) => void
 *   }
 *   b: {
 *     b1: () => boolean
 *     b2: () => string[]
 *   }
 *   c: () => string
 * }
 *
 * type Result1 = PathValue<ExampleType, 'a'>
 * // { a1: () => number; a2: (arg: number) => void }
 *
 * type Result2 = PathValue<ExampleType, 'a.a1'>
 * // () => number
 *
 * type Result3 = PathValue<ExampleType, 'b.b2'>
 * // () => string[]
 */
export type PathValue<
  T,
  P extends string,
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never

/**
 * 指定されたパスに対応する関数型を取得します。
 *
 * @example
 * type ExampleType = {
 *   a: {
 *     a1: () => number
 *     a2: (arg: number) => void
 *   }
 *   b: {
 *     b1: () => boolean
 *     b2: () => string[]
 *   }
 *   c: () => string
 * }
 *
 * // エラー: 型 '"a"' は制約 'RecursiveMethodKeys<ExampleType>' を満たしていません。
 * type Result1 = ExtractMethod<ExampleType, 'a'>
 * // never
 *
 * type Result2 = ExtractMethod<ExampleType, 'a.a1'>
 * // () => number
 *
 * type Result3 = ExtractMethod<ExampleType, 'b.b2'>
 * // () => string[]
 */
export type ExtractMethod<
  TApiType extends Api,
  TMethodKey extends RecursiveMethodKeys<TApiType>,
> =
  PathValue<TApiType, TMethodKey> extends (
    ...args: infer TArgs
  ) => infer TReturn
    ? (...args: TArgs) => TReturn
    : never

export type ExtractAddListener<
  TElectronMainApi extends Api,
  TChannel extends RecursiveMethodKeys<TElectronMainApi>,
> =
  ExtractMethod<TElectronMainApi, TChannel> extends (
    listener: (...args: infer TArgs) => void,
  ) => () => void
    ? (listener: (...args: TArgs) => void) => () => void
    : never

/**
 * 任意の関数 T を受け取り、最初の引数に WebContents を追加した関数型を返す
 *
 * @example
 * type Fn1 = (a: number) => Promise<string>
 * type Fn2 = () => Promise<string>
 * type Fn3 = (a: number, b: string) => Promise<string>
 *
 * type Fn1WithWebContents = WithWebContents<Fn1>
 * // (a: number, webContents: WebContents) => Promise<string>
 *
 * type Fn2WithWebContents = WithWebContents<Fn2>
 * // (webContents: WebContents) => Promise<string>
 *
 * type Fn3WithWebContents = WithWebContents<Fn3>
 * // (a: number, b: string, webContents: WebContents) => Promise<string>
 */
export type WithWebContents<T extends AnyFunction> = T extends (
  ...args: infer TArgs
) => infer TReturn
  ? (...args: [...TArgs, WebContents]) => TReturn
  : never

/**
 * 任意の API オブジェクト T のすべての関数を WithWebContents 化した型を生成します。
 *
 * @example
 * type MyApi = {
 *   foo: (x: number) => Promise<string>
 *   bar: {
 *     baz: (y: string) => Promise<number>
 *   }
 * }
 *
 * type MyApiWithWebContents = WithWebContentsApi<MyApi>
 * // Expected:
 * // type MyApiWithWebContents = {
 * //   foo: (x: number, webContents: WebContents) => Promise<string>
 * //   bar: {
 * //     baz: (y: string, webContents: WebContents) => Promise<number>
 * //   }
 * // }
 */
export type WithWebContentsApi<T extends Api> = {
  [K in keyof T]: T[K] extends AnyFunction
    ? WithWebContents<T[K]>
    : T[K] extends Api
      ? WithWebContentsApi<T[K]>
      : T[K]
}

export type IpcInvokeEntry<
  TElectronMainApi extends Api,
  TChannel extends RecursiveMethodKeys<TElectronMainApi>,
> = {
  type: 'invoke'
  method: WithWebContents<ExtractMethod<TElectronMainApi, TChannel>>
}

export type IpcEventEntry<
  TElectronMainApi extends Api,
  TChannel extends RecursiveMethodKeys<TElectronMainApi>,
> = {
  type: 'event'
  addEventListener: WithWebContents<
    ExtractAddListener<TElectronMainApi, TChannel>
  >
}

export type IpcRegistrationMap<TElectronMainApi extends Api> = {
  [K in RecursiveMethodKeys<TElectronMainApi>]:
    | IpcInvokeEntry<TElectronMainApi, K>
    | IpcEventEntry<TElectronMainApi, K>
}
