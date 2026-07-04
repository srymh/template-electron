export function toSafeExternalHref(href: string | undefined): string | undefined {
  if (!href) return undefined

  // 相対リンクやアンカーは、チャット本文（非信頼）では無効化する。
  if (href.startsWith('/') || href.startsWith('#')) return undefined

  try {
    const url = new URL(href)
    if (url.username || url.password) return undefined

    switch (url.protocol) {
      case 'https:':
      case 'http:':
      case 'mailto:':
        return url.toString()
      default:
        return undefined
    }
  } catch {
    return undefined
  }
}
