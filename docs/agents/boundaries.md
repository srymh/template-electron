# パッケージ境界詳細

## 基本方針

- 再利用可能なロジックは `packages/*` に置き、desktop 固有の I/O や native 依存は `apps/desktop` に残す。
- 新しい shared package では Electron runtime への直接依存を増やさず、callback や adapter 注入を優先する。
- renderer から見える公開面は `@your-app-name/api` に集約し、`apps/web` から `window.api` を直接触らない。

## auth と sqlite

- `packages/auth` は認証ロジック、スキーマ初期化、`AuthRuntime` を持ち、依存は `@repo/sqlite` に留める。
- `createAuthRuntime` は `db` または `createDb` を受け取れる。`createDb` を渡した場合は `dispose()` で DB を閉じる。
- `packages/sqlite` は同期 SQLite 抽象だけを持ち、`better-sqlite3` の import・rebuild・packaging は `apps/desktop` が担当する。

## iframe と frame-rpc

- iframe には preload が入らないため `window.api` は未定義になる。
- `apps/api/src/api.ts` は iframe で `@repo/frame-rpc` の `requestAuthStatusFromParent` / `registerAuthStatusResponder` を使って認証状態を橋渡しする。
- iframe でも使いたい機能を増やすなら、fallback を `apps/api/src/api.ts` に追加するか、親 window 経由の bridge を設計する。

## IPC event 契約

- event 型 API では renderer が先に listener を登録しても成立する設計を保つ。
- main 側の `addEventListener` 実装は、producer がまだ始まっていない状態でも登録できる必要がある。
- セッション依存の stream を event で流すときは、一時 queue だけに頼らず状態を保持して race を避ける。
