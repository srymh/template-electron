export function createTitleBarOverlay() {
  // 起動時 nativeTheme には OS の設定が反映されており、
  // レンダラーで保持されたテーマとは異なる可能性がある。
  // そのため、起動時には透明なオーバーレイを設定しておき、
  // レンダラーからテーマが送られてきたタイミングで色を更新する。
  return {
    color: '#00000000', // 背景
    symbolColor: '#00000000', // シンボル
    height: 29,
  }
}
