/** CASへ保存された内容の識別情報。 */
export type CasObject = {
  sha256: string
  byteSize: number
}

/** CASへの保存結果。 */
export type CasPutResult = CasObject & {
  /** 同じ内容が存在せず、この呼び出しで新しく保存した場合は`true`。 */
  created: boolean
}

/** CAS上の内容とcontent addressの検証結果。 */
export type CasVerification =
  | { status: 'missing' }
  | ({ status: 'valid' } & CasObject)
  | ({ status: 'corrupt'; actualSha256: string } & CasObject)

/** バイト列の一部を読む場合の、先頭からの位置と長さ。 */
export type CasReadRange = { offset: number; length: number }

export type CasReadStream = {
  byteSize: number
  content: AsyncIterable<Uint8Array>
}

/** 保存する内容の事前情報を検証するための入力。 */
export type CasPutOptions = {
  /** streamなどの事前情報を実測値と照合したい場合に指定する。 */
  expectedByteSize?: number
}

/** 利用側domainに依存せず、バイト列をcontent addressで扱うstorage境界。 */
export type Cas = {
  /** 既存の同一digestも内容を検証して再利用し、破損時は上書きせず失敗する。 */
  put: (content: Uint8Array, options?: CasPutOptions) => Promise<CasPutResult>
  /** 既存の同一digestも検証し、破損した本体を正常な保存として扱わない。 */
  putStream: (content: AsyncIterable<Uint8Array>, options?: CasPutOptions) => Promise<CasPutResult>
  read: (sha256: string) => Promise<Uint8Array>
  readStream: (sha256: string, range?: CasReadRange) => Promise<CasReadStream>
  list: () => Promise<CasObject[]>
  exists: (sha256: string) => Promise<boolean>
  verify: (sha256: string) => Promise<CasVerification>
  remove: (sha256: string) => Promise<void>
}
