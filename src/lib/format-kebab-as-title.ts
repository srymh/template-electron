/**
 * kebab-case の文字列をタイトル形式に変換する
 * 例: "my-component-name" -> "My Component Name"
 */
export function formatKebabAsTitle(s: string) {
  return s
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
