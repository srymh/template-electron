import { ObjectStoreError } from './contracts'

/** 要求した取得サイズを消費時に検査する。中断や元のI/O例外では不足判定を行わない。 */
export async function* validateContentStream(
  key: string,
  content: AsyncIterable<Uint8Array>,
  expectedByteSize: number,
): AsyncIterable<Uint8Array> {
  let receivedByteSize = 0
  for await (const chunk of content) {
    // 超過分を含むchunkは外へ渡さず、元のiteratorもfor-awaitで閉じる。
    if (chunk.byteLength > expectedByteSize - receivedByteSize) {
      throw new ObjectStoreError('corrupt-content', key)
    }
    receivedByteSize += chunk.byteLength
    yield chunk
  }
  // 正常に最後まで消費した場合だけ、不足を確定する。
  if (receivedByteSize !== expectedByteSize) throw new ObjectStoreError('corrupt-content', key)
}
