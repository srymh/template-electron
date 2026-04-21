# Electron Template

Electron（Main/Preload）+ Vite（Renderer）構成のテンプレートです。React + TypeScript を前提に、TanStack Router/Query などのフロントエンド基盤と、electron-builder による配布ビルドまでを含みます。

| Screenshot (Windows)               | Screenshot (macOS)                         |
| ---------------------------------- | ------------------------------------------ |
| ![screenshot](docs/screenshot.png) | ![screenshot mac](docs/screenshot_mac.png) |

## 特徴

- Renderer: Vite + React + TypeScript
- Routing/Data: TanStack Router / TanStack Query
- Styling: Tailwind CSS
- Desktop: Electron（Main/Preload）
- Build/Package: electron-builder
- Test: Vitest（jsdom）

## 動作環境

- Node.js（LTS推奨）
- pnpm

## セットアップ

```bash
pnpm install
```

## 開発（ホットリロード）

```bash
pnpm dev
```

## VS Code デバッグ（任意）

VS Code からデバッグ起動する場合、dev server の host/port が `package.json` の `debug.env.VITE_DEV_SERVER_URL`（デフォルト: `http://127.0.0.1:7777`）に合わせて起動します。

## ビルド（配布物作成）

```bash
pnpm build
```

生成物の例:

- `dist/`（Vite Renderer のビルド成果物）
- `dist-electron/`（Electron Main/Preload のビルド成果物）
- `release/`（electron-builder の成果物）

## よく使うコマンド

| コマンド      | 内容                                           |
| ------------- | ---------------------------------------------- |
| `pnpm dev`    | 開発サーバ起動（Vite）                         |
| `pnpm build`  | Renderer + Electron をビルドしてパッケージ作成 |
| `pnpm test`   | 型チェック + Vitest                            |
| `pnpm lint`   | 型チェック + oxlint                            |
| `pnpm format` | oxfmtで整形                                    |
| `pnpm check`  | 型チェック + oxfmt整形 + oxlint自動修正        |

## ディレクトリ構成

- `src/`：Renderer（React）
- `electron/main/`：Electron Main プロセス
- `electron/preload/`：Preload スクリプト
- `public/`：静的ファイル
- `data/`：SQLなど開発用データ（例: 初期化/サンプル）
- `dist/`：Vite Renderer のビルド成果物
- `dist-electron/`：Electronビルド出力（生成物）
- `release/`：配布用ビルド出力（生成物）

## トラブルシューティング

- `better-sqlite3` などのネイティブ依存が入るため、インストール後にビルドが必要になることがあります（本プロジェクトでは `postinstall` で `electron-builder install-app-deps` を実行します）。
- 依存関係が壊れた/再構築したい場合は、`pnpm install` のやり直しや、`dist-electron/`・`release/` の削除後に再ビルドを試してください。

## ライセンス

MIT License
