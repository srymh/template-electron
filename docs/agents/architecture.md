# アーキテクチャ詳細

## 呼び出し境界

- `apps/web` から Electron API を使うときは `@repo/api` を入口にする。
- Electron 実行時の経路は `apps/web` → `apps/api/src/api.ts` → `window.api` → `apps/desktop/src/preload/index.ts` → `apps/desktop/src/main/ipc/electronApi.ts` → `apps/desktop/src/main/ipc/registerIpc.ts` → `apps/desktop/src/main/api/*`。
- iframe は preload を継承しないため `window.api` は使えない。iframe 向けの fallback や親画面との bridge は `apps/api/src/api.ts` と `@repo/frame-rpc` に集約する。

## IPC/API を追加する手順

1. `apps/desktop/src/main/api/<module>.ts` に API 型と実装を追加する。
2. window 単位の状態が必要なら、`apps/desktop/src/main/ipc/registerIpc.ts` の `Context` と `apps/desktop/src/main/index.ts` の `createWindowContext()` を拡張する。
3. `apps/desktop/src/main/ipc/registerIpc.ts` に invoke/event のチャネルを登録する。
4. `apps/desktop/src/main/ipc/electronMainApi.ts` または `apps/desktop/src/main/ipc/electronRendererApi.ts` に surface を追加し、`apps/desktop/src/main/ipc/electronApi.ts` の merge 結果に含める。
5. `apps/api/src/api.ts` に Electron 側 wrapper と browser/iframe fallback を追加する。
6. 利用側の `apps/web` を更新し、関連 workspace の lint/test を実行する。

## Event 型の注意

- `packages/ipc` の event 契約は、renderer が先に listener を張ってから main に登録が飛ぶ前提で動く。
- `addEventListener` 実装は listener-first と producer-first の両方を許容する。
- チャットや stream のような状態依存イベントは、単発 queue だけでなく session 状態を保持してレースを避ける。

## 既存の責務分担

- `apps/desktop/src/main/index.ts` が app 全体の context を初期化し、window ごとの context を作る。
- `apps/desktop/src/main/ipc/registerIpc.ts` が main 側のチャネル登録をまとめる。
- `apps/desktop/src/main/ipc/electronMainApi.ts` が main 由来 API、`apps/desktop/src/main/ipc/electronRendererApi.ts` が renderer-only API を定義する。
- `apps/api/src/api.ts` は renderer から見た唯一の公開入口として扱う。
