# データベースとパッケージング詳細

## パス解決

- `apps/desktop/src/main/infra/paths.ts` が main/preload/renderer/data の絶対パスを一元的に計算する。
- 開発時の `dataPath` は app root 配下の `data/`、本番時は `process.resourcesPath/data` を使う。
- packaged 環境では renderer の HTML は `web/dist/index.html`、preload は `dist/preload/index.cjs` を参照する。

## better-sqlite3 と asar

- `apps/desktop/vite.config.ts` では `better-sqlite3` を external にして、asar 内の依存解決問題を避ける。
- `apps/desktop/electron-builder.json5` は `asar: true`、`asarUnpack: ['**/*.node']`、`extraResources: ['data/**']` を使う。
- DB ファイルの配置や native module の扱いを変えるときは、`apps/desktop/src/main/infra/paths.ts`、`apps/desktop/vite.config.ts`、`apps/desktop/electron-builder.json5` をセットで確認する。

## package ごとの責務

- `packages/sqlite` は driver 非依存の同期 SQLite 抽象だけを持つ。
- `apps/desktop/src/main/infra/db.ts` が `better-sqlite3` を `@repo/sqlite` に接続する adapter を担当する。
- `packages/auth` は認証スキーマと `AuthRuntime` を持ち、desktop 側は `apps/desktop/src/main/index.ts` で `userData/auth.db` を開く `createDb` を注入する。

## 変更時の確認ポイント

- `apps/desktop/data/*.sql` を変えるときは、既存 DB・サンプルデータ・利用側クエリの互換性を確認する。
- DB ファイル名や置き場を変えるときは、`apps/desktop/src/main/index.ts` の `kakeibo.db` / `auth.db` 参照箇所も更新する。
- packaging を触る場合は、native rebuild、asar、extraResources の 3 点を同時に確認する。
