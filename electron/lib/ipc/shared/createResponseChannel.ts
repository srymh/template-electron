/**
 * 応答チャンネル名を生成します。
 *
 * 使用できるプロセス
 * - renderer process: OK
 * - main process: OK
 *
 * @param channel
 * @returns 応答チャンネル名
 */
export function createResponseChannel(channel: string): string {
  // 応答チャンネル名を生成
  return `${channel}::response`
}
