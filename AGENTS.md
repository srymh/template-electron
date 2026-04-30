# AGENTS.md

## プロジェクト概要

- pnpm workspace の monorepo で、Electron デスクトップアプリ、Vite/React レンダラー、共有 TypeScript package を持つ。
- `apps/desktop` が Electron main/preload とパッケージングを担当し、`apps/web` が UI、`apps/api` が renderer 向け API 境界と browser fallback を担当する。
- `packages/*` には IPC、認証、RAG、sqlite 抽象、AI chat、UI helper を置く。

## 技術スタック

- TypeScript + ESM。
- Electron 41、Vite 8、React 19、TanStack Router/Query/AI、Tailwind 4。
- ツールチェーンは pnpm 10 workspace、Vitest、oxlint、oxfmt。
- native 依存として desktop で `better-sqlite3` を使い、RAG と一部テストでは `node:sqlite` も使う。

## コマンド

- インストール: `pnpm install`
- 開発起動: `pnpm dev`
- ビルド: `pnpm build`
- テスト: `pnpm test`
- lint: `pnpm lint`
- 整形: `pnpm format`
- ルート `check`: `pnpm check`

注記:

- ルートの `pnpm test` は `pnpm -r run test` なので、`test` script を持つ workspace だけが対象。
- ルートの `pnpm check` は現状 `apps/desktop` だけを対象にする。web/shared の変更は workspace 単位でも検証する。
- lint/format は `oxlint` と `oxfmt` ベースで、repo ルートの ESLint/Prettier 設定はない。

変更範囲向けの検証例:

- web の単一テスト: `pnpm --filter @your-app-name/web exec vitest run src/components/theme-provider.test.tsx`
- shared package のテスト: `pnpm --filter @repo/auth run test`
- desktop の lint/typecheck: `pnpm --filter your-app-name run lint`
- web の lint/typecheck: `pnpm --filter @your-app-name/web run lint`

## リポジトリ構造

- `apps/desktop/src/main`: Electron main、IPC 登録、DB/path adapter、window 作成。
- `apps/desktop/src/preload`: `window.api` を公開する preload bridge。
- `apps/web/src`: route、component、feature、hook、style。
- `apps/api/src/api.ts`: renderer API 境界。Electron では `window.api` を使い、browser/iframe では fallback/mock を返す。
- `packages/*`: `ipc`、`auth`、`rag`、`sqlite`、`ai-tools`、`frame-rpc`、`shadcn` などの再利用 package。
- `docs/agents/*.md`: AGENTS.md から分離した詳細ルール。
- 生成物/ビルド成果物: `apps/web/src/routeTree.gen.ts`、`dist/`、`dist-electron/`、`release/`。

## コーディングルール

- 各 workspace の `tsconfig.json` に従う。`strict`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`、`noUncheckedSideEffectImports` は有効。
- ESM import を使い、型だけの import には `import type` を使う。
- 同じ責務を app 側に複製せず、既存の workspace package を優先して再利用する。
- `apps/web` から Electron module を直接 import しない。renderer からの呼び出しは `@your-app-name/api` を通す。
- `window.api` への直接アクセスは preload か `apps/api/src/api.ts` に閉じ込める。iframe fallback もそこに集約する。
- `apps/web/src/routeTree.gen.ts` は生成ファイルなので編集しない。
- `apps/desktop/src/main/windows/createWindow.ts` の BrowserWindow セキュリティ設定は維持する。`contextIsolation`、`sandbox`、`webviewTag` は固定し、`nodeIntegration` は無効のままにする。
- desktop 固有の実装は `apps/desktop` に残し、再利用ロジックは `packages/*` に寄せる。package 側が desktop API を要するときは callback/adapter 注入を優先する。
- 既に `'use no memo'` を使っている component では、明確な理由なしに外さない。
- `any` は避ける。境界で型を緩める必要がある場合は、cast を局所化して最終報告で理由を説明する。
- IPC/API surface を追加したら、desktop 側の IPC 実装と `apps/api/src/api.ts` の wrapper を両方更新する。

## テストルール

- 主なテスト入口は `pnpm test`。
- web テストは `apps/web/vite.config.ts` の Vitest `jsdom` 設定を使う。
- テストファイルは source の近くに `*.test.ts` / `*.test.tsx` として置く。
- 変更後はまず最も狭い検証を実行し、必要なら段階的に広げる。
- workspace package にテストを追加するなら `test` script も追加する。script がない package は root `pnpm test` で実行されない。
- 仕様変更や明示依頼なしにテスト期待値を書き換えない。
- 検証できない場合は、実行できなかった理由をそのまま報告する。

## 変更ポリシー

- 変更は局所化し、無関係なリファクタリングを混ぜない。
- auth、IPC 契約、DB schema/data、native module 配線、window security は高リスク領域として扱う。
- lockfile は依存関係が実際に変わる場合だけ更新する。
- `dist/`、`dist-electron/`、`release/` などの生成物は編集・コミットしない。
- `apps/desktop/data/*.sql`、認証セッション、preload 公開面、package export を変える前に影響範囲を確認する。
- `apps/api` には単独の test/build script がないので、変更時は利用側 workspace で検証する。

## エージェントの進め方

- 変更前に担当 workspace と近傍実装を読み、既存パターンを踏襲する。
- 最小の差分で編集し、直後に最も狭い検証を実行する。
- renderer 機能では新しい bridge を足す前に `@your-app-name/api` の既存面を確認する。
- desktop/native 変更では `apps/desktop/src/main/infra` と `apps/desktop/vite.config.ts` の path/packaging 実装を確認する。
- 最終報告には、変更ファイル、実行した検証、未実行の検証と理由、TODO/残リスクを含める。

## 参考資料

- `docs/agents/architecture.md`: renderer-preload-main 間の境界と IPC/API 追加手順。
- `docs/agents/database.md`: DB path、asar、native module packaging、auth/sqlite の責務分離。
- `docs/agents/testing.md`: root test 導線、workspace ごとの検証、テスト追加時の配線ルール。
- `docs/agents/boundaries.md`: package boundary、iframe/frame-rpc、Electron 依存の扱い。
- `README.md`: セットアップとビルドの概要。
- `apps/api/src/api.ts`: renderer API 境界と fallback 実装。
- `apps/desktop/src/main/windows/createWindow.ts`: BrowserWindow セキュリティ設定とナビゲーション制御。
- `apps/web/vite.config.ts`: web の test 環境と router/compiler 設定。
