# テストと検証詳細

## 現在の検証入口

- ルートの `pnpm test` は `pnpm -r run test` を実行する。
- 現在 root test に載る workspace は `apps/desktop`、`apps/web`、`packages/auth`、`packages/ai-chat-session`、`packages/deep-merge`、`packages/ipc`、`packages/rag`。
- `apps/api` には `test` script がないため、変更時は利用側テストか lint/typecheck で検証する。
- ルートの `pnpm check` は `apps/desktop` の `check` だけを実行する。

## よく使う検証コマンド

- web の単一テスト: `pnpm --filter @your-app-name/web exec vitest run src/components/theme-provider.test.tsx`
- desktop の単一 workspace テスト: `pnpm --filter your-app-name run test`
- shared package テスト: `pnpm --filter @repo/auth run test`
- web の lint/typecheck: `pnpm --filter @your-app-name/web run lint`
- desktop の typecheck: `pnpm --filter your-app-name run typecheck`
- 変更を広く見るとき: `pnpm test`

## 新しいテストを追加するとき

1. source の近くに `*.test.ts` または `*.test.tsx` を置く。
2. workspace の `package.json` に `test: "tsgo --noEmit && vitest run"` を追加する。
3. まず workspace 単位の test を実行し、その後 root `pnpm test` に載せたい変更なら root 側も実行する。

## 運用ルール

- まず最小の検証を実行し、必要な場合だけ広げる。
- 仕様変更やユーザー依頼がない限り、既存テストの期待値は変更しない。
- 実行できなかった検証は、コマンド名と失敗理由を最終報告に残す。
- `apps/api/src/api.ts` を変えた場合は、その package 自体に test script がないため `apps/web` など利用側で確認する。
