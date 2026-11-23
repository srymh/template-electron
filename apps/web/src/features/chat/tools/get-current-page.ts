import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

/**
 * 実行時点の DOM のタイトルとページ位置を取得する client ツール。
 * renderer の要求で定義を宣言し、main 側への定義の import は不要。
 */
export const getCurrentPageTool = toolDefinition({
  name: 'get_current_page',
  description:
    'Get the title, pathname, and hash of the page currently open in the app. Use this when the user asks which screen or page they are viewing.',
  inputSchema: z.object({}),
}).client(() => ({
  title: document.title,
  pathname: window.location.pathname,
  hash: window.location.hash,
}))
