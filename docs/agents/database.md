# データベースとパッケージング詳細

## パス解決

- `apps/desktop/src/main/infra/paths.ts` が main/preload/renderer/data の絶対パスを一元的に計算する。
- 開発時の `dataPath` は app root 配下の `data/`、本番時は `process.resourcesPath/data` を使う。
- packaged 環境では renderer の HTML は `web/dist/index.html`、preload は `dist/preload/index.cjs` を参照する。

## better-sqlite3 と asar

- `better-sqlite3` は optional SQLite driver だが、選択時に native module を asar 外から読み込めるよう `apps/desktop/vite.config.ts` では external のままにする。
- `apps/desktop/electron-builder.json5` は `asar: true`、`asarUnpack: ['**/*.node']`、`extraResources: ['data/**']` を使う。
- DB ファイルの配置や native module の扱いを変えるときは、`apps/desktop/src/main/infra/paths.ts`、`apps/desktop/vite.config.ts`、`apps/desktop/electron-builder.json5` をセットで確認する。

## SQLite driver

- 既定 driver は `better-sqlite3`。
- `SQLITE_DRIVER=node:sqlite` を指定すると `node:sqlite` adapter を使い、`better-sqlite3` の postinstall rebuild は skip される。
- `better-sqlite3` の rebuild を避ける場合は `SQLITE_DRIVER=node:sqlite pnpm install` を使う。
- `better-sqlite3` の optional dependency install 自体も除外する場合は、pnpm の `ignoredOptionalDependencies` を project/global config に設定する。
- `--no-optional` は使わない。Vite / Rolldown などの toolchain が必要とする native optional dependency も skip される。
- `SKIP_BETTER_SQLITE3_REBUILD=1` は rebuild だけを skip する。runtime driver は変えない。
- packaged app では build 時の `SQLITE_DRIVER` も main/preload bundle に埋め込まれる。runtime env があれば runtime env を優先する。
- `node:sqlite` が runtime に存在しない場合は adapter が明示エラーを投げる。

## package ごとの責務

- `packages/sqlite` は driver 非依存の同期 SQLite 抽象と `node:sqlite` adapter を持つ。
- `apps/desktop/src/main/infra/db.ts` は driver selection と `better-sqlite3` lazy adapter を担当する。
- `packages/auth` は認証スキーマと `AuthRuntime` を持ち、desktop 側は `apps/desktop/src/main/index.ts` で `userData/auth.db` を開く `createDb` を注入する。
- `packages/rag` の既定ストレージは `node:sqlite` ベースで、desktop 側は `data/example.db` を検索用 DB として参照する。

## 変更時の確認ポイント

- `apps/desktop/data/*.sql` を変えるときは、既存 DB・サンプルデータ・利用側クエリの互換性を確認する。
- DB ファイル名や置き場を変えるときは、`apps/desktop/src/main/index.ts` の `kakeibo.db` / `auth.db` / `example.db` 参照箇所も更新する。
- packaging を触る場合は、driver selection、native rebuild、asar、extraResources の 4 点を同時に確認する。
