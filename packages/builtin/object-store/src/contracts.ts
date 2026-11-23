/** JSONとして永続化できる値。 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

/** キーごとに保持する内容の解釈と利用側の情報。 */
export type ObjectMetadata = {
  mediaType: string | null
  fileName: string | null
  attributes: JsonValue
}

export type ObjectMetadataInput = Partial<ObjectMetadata>

/** adapterが発行する不透明な更新token。数値への変換や大小比較はしない。 */
export type ObjectRevision = string

/** 内容の保存方式に依存しない、名前付きオブジェクトの情報。 */
export type StoredObject = {
  /**
   * UTF-8で1〜1024バイトの、有効なUnicodeからなるキー。大小文字・空白・正規化形式を保持する。
   * 制御文字・バックスラッシュは禁止。スラッシュ区切りの空セグメントと単独の「.」「..」も禁止する。
   */
  key: string

  /**
   * オブジェクトの内容のバイト数
   */
  byteSize: number

  /**
   * オブジェクトのmetadata
   */
  metadata: ObjectMetadata

  /**
   * オブジェクトのrevision
   *
   * metadata更新・キー変更の競合検出に使用する。
   *
   * @note オブジェクトの世代管理情報ではない。ABA問題を回避するためのものである。
   * このrevisionは内部的に管理されるものであり、直接の数値操作や比較は行わない。
   */
  revision: ObjectRevision
}

export type ObjectReadRange = { offset: number; length: number }

/**
 * キーの昇順（UTF-8のバイト列の順）で先頭から数えた取得範囲。offsetは0以上、limitは1以上の安全な整数。
 * 範囲外のoffsetは空の結果になる。
 */
export type ObjectListRange = { offset: number; limit: number }
export type ObjectPutInput = { key: string; metadata?: ObjectMetadataInput }
export type ObjectPutResult = { created: boolean; object: StoredObject }
export type ObjectVerification =
  | { status: 'missing-key' }
  | { status: 'valid' | 'missing-content' | 'corrupt-content'; object: StoredObject }

/**
 * キーで内容とmetadataを扱う保存境界。
 * hostが外側transactionを所有する場合、結果・revisionはcommitまで暫定値とし、
 * commit前に確定結果として外部へ公開・利用せず、rollback時は破棄する。
 */
export type ObjectStore = {
  /** 現在の内容・metadataと一致する再登録だけを冪等成功とし、既存revisionを維持する。 */
  put: (input: ObjectPutInput & { content: Uint8Array }) => Promise<ObjectPutResult>
  putStream: (
    input: ObjectPutInput & { content: AsyncIterable<Uint8Array> },
  ) => Promise<ObjectPutResult>
  find: (key: string) => Promise<StoredObject | null>
  /** キーのUTF-8バイト列の昇順で列挙する。列挙全体のsnapshotや並行変更の完全な捕捉は保証しない。 */
  list: () => AsyncIterable<StoredObject>
  /**
   * キーのUTF-8バイト列の昇順で、指定範囲のオブジェクトだけを取得する。範囲より前のキーは読み込まない。
   * 呼び出し間のsnapshotは保証せず、追加・削除・キー変更で範囲の位置はずれ得る。
   */
  listRange: (range: ObjectListRange) => Promise<StoredObject[]>
  /** digestは検証しないため、通常の読み取りだけでは内容の完全性を保証しない。 */
  read: (key: string) => Promise<Uint8Array>
  /**
   * 取得したindex recordのsnapshotと内容を返す。要求範囲も呼び出し時に確定する。
   * 取得バイト数の超過は消費中、不足は正常終了時にcorrupt-contentとして通知する。
   * 途中キャンセルは不足としない。部分取得を含めdigestは検証せず、全体の完全性はverifyで検査する。
   */
  readStream: (
    key: string,
    range?: ObjectReadRange,
  ) => Promise<{
    object: StoredObject
    content: AsyncIterable<Uint8Array>
  }>
  /** digestの一致と、indexのbyteSizeと実測サイズの一致を検査する。不一致はいずれもcorrupt-content。 */
  verify: (key: string) => Promise<ObjectVerification>
  /** metadata全体を置換する。省略した項目はnullに戻る。 */
  updateMetadata: (input: {
    key: string
    expectedRevision: ObjectRevision
    metadata: ObjectMetadataInput
  }) => Promise<StoredObject>
  /**
   * 内容・metadataを保持してキーを原子的に変更する。CASにはアクセスしない。
   * 元キーのrevision一致と変更先の未使用を同時に検査し、変更時は新しいrevisionを発行する。
   * 同一キーへの変更はrevisionを検査した上で変更なしとする。
   * @throws missing-key、revision-conflict、key-conflict。失敗時は元・変更先を保持する
   * @remarks 外部のキー参照は追従しない。本体の存在・健全性も検査しない
   */
  rename: (input: {
    key: string
    newKey: string
    expectedRevision: ObjectRevision
  }) => Promise<StoredObject>
  /** キーだけを削除し、CAS本体は保持する。 */
  remove: (key: string) => Promise<boolean>
}

export type ObjectStoreErrorCode =
  | 'key-conflict'
  | 'missing-key'
  | 'missing-content'
  | 'corrupt-content'
  | 'revision-conflict'

/** 保存対象の欠落・破損・更新競合を区別するエラー。 */
export class ObjectStoreError extends Error {
  constructor(
    public readonly code: ObjectStoreErrorCode,
    public readonly key: string,
    options?: ErrorOptions,
  ) {
    super(`Object store ${code}: ${key}`, options)
    this.name = 'ObjectStoreError'
  }
}
