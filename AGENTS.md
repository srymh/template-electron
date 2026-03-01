# AGENTS.md

Electron + Vite + React + TypeScript テンプレートプロジェクト。
このファイルは AI エージェントがコードを正しく書くための操作マニュアルである。

---

## プロジェクト概要

デスクトップアプリケーションのテンプレート。Electron メインプロセスとレンダラー（React）を
独自の型安全な IPC フレームワークで接続し、認証・AI チャット・MCP・RAG・家計簿デモなどの
機能を実装している。

---

## コマンド（pnpm）

### 基本コマンド

| コマンド | 説明 | 内部実行 |
|---|---|---|
| `pnpm install` | 依存インストール | `postinstall` で `electron-builder install-app-deps` も実行 |
| `pnpm dev` | 開発サーバー起動 | Vite + vite-plugin-electron で Electron も同時起動（HMR 有効） |
| `pnpm build` | プロダクションビルド | `vite build && tsc && electron-builder` |
| `pnpm serve` | ビルド済みレンダラーのプレビュー | Vite preview |
| `pnpm test` | 型チェック + テスト | `tsc --noEmit && vitest run` |
| `pnpm lint` | 型チェック + lint | `tsc --noEmit && eslint` |
| `pnpm format` | コード整形 | Prettier write |
| `pnpm check` | オートフィックス | `tsc --noEmit && prettier --write . && eslint --fix` |

ビルド出力先: `dist/`（レンダラー）、`dist-electron/`（メイン・プリロード）、`release/`（パッケージ済みアプリ）。

### 単一テストの実行（Vitest）

`pnpm test` は毎回フル型チェックを行う。高速に反復するには Vitest を直接呼ぶ。

```bash
# ファイル指定
pnpm vitest run src/components/table/debounced-input.test.tsx
pnpm vitest run electron/shared/lib/ipc/browser/deepMerge.test.ts

# テスト名パターン
pnpm vitest run -t "DebouncedInput"
pnpm vitest run -t "deepMerge"

# ウォッチモード
pnpm vitest src/components/table/debounced-input.test.tsx

# CI 風（UI なし・確定実行）
pnpm vitest run --reporter=default

# 型チェックのみ
pnpm tsc --noEmit
```

### 単一ファイルの Lint / Format

```bash
# lint
pnpm eslint src/routes/(app)/demo.table.tsx
pnpm eslint electron/main/index.ts

# autofix
pnpm eslint --fix src/routes/(app)/demo.table.tsx

# format
pnpm prettier --write src/routes/(app)/demo.table.tsx
```

---

## プロジェクト構成

### ディレクトリ構造

```
template-electron/
├── data/                        # DB ファイル・マイグレーション SQL
├── electron/
│   ├── main/                    # Electron メインプロセス
│   │   ├── index.ts             # エントリ・AppContext 定義
│   │   ├── app/startApp.ts      # アプリライフサイクル管理
│   │   ├── api/                 # IPC API ハンドラー（7モジュール）
│   │   ├── features/            # 機能実装（auth, chat, db, mcp）
│   │   ├── infra/               # パス解決・カスタムプロトコル
│   │   ├── ipc/                 # IPC 登録（registerIpc.ts）
│   │   └── windows/             # ウィンドウ生成・コンテキストメニュー
│   ├── preload/index.ts         # contextBridge で window.api を公開
│   ├── shared/lib/              # メイン・レンダラー共有ライブラリ
│   │   ├── ipc/                 # 型安全 IPC フレームワーク
│   │   ├── tanstack-ai-mcp/     # MCP ↔ TanStack AI ブリッジ
│   │   └── rag/                 # RAG ライブラリ（ingest / retrieve）
│   └── electron-env.d.ts        # Window.api 型宣言
├── scripts/rag/                 # RAG サンプルスクリプト・テストデータ
├── src/                         # レンダラー（React アプリケーション）
│   ├── main.tsx                 # エントリ（プロバイダー群のネスト）
│   ├── api.ts                   # デュアル API レイヤー（Electron / ブラウザ）
│   ├── router.tsx               # TanStack Router（Hash History）
│   ├── routeTree.gen.ts         # 自動生成ルートツリー（編集禁止）
│   ├── components/ui/           # shadcn/ui ベンダーコード（56 種類）
│   ├── features/                # auth, chat, style, ui-demo
│   ├── lib/                     # fetchIpcEvents, frame-rpc, utils
│   ├── routes/                  # ファイルベースルート定義
│   └── styles/                  # スタイルテーマ CSS
├── package.json
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
├── electron-builder.json5
└── index.html
```

### パスエイリアス

| エイリアス | 解決先 | 使用場所 |
|---|---|---|
| `@/*` | `src/*` | レンダラーコード |
| `#/*` | `electron/*` | Electron コード（main / shared） |

---

## アーキテクチャ

### Electron メインプロセスのライフサイクル

`electron/main/index.ts` → `startApp()` でアプリを起動する。

1. `startApp` が `AppContext`（グローバル共有状態）を初期化する。
   - `windowsById`: ウィンドウ管理用 Map
   - `db`: better-sqlite3 ラッパー
   - `authRuntime`: 認証ランタイム
   - `mcpServer`: MCP サーバーインスタンス
2. `createWindow()` で BrowserWindow を生成する。
3. アプリ終了時に `dispose()` でリソースを解放する（DB 接続のクローズ等）。

### Context-per-Window パターン

各 BrowserWindow ごとに `Context` オブジェクトを `WeakMap<WebContents, Context>` で保持する。
Context はサブコンテキスト（theme, mcp, aiChat, kakeibo, auth）を含む。

WebContents をキーにした WeakMap により、ウィンドウ破棄時に自動 GC される。

**新しいウィンドウ固有の状態を追加する場合**: `createWindowContext()` に新しいサブコンテキストを追加し、
対応する API モジュールから参照する。

### IPC フレームワーク

`electron/shared/lib/ipc/` に実装された独自フレームワーク。型安全なチャネル名とハンドラーを提供する。

**中核コンセプト**:
- API 型定義（ネストされたオブジェクト）からドット区切りのチャネル名（例: `'fs.readFileAsText'`）を型レベルで導出する。
- `type: 'invoke'`（リクエスト/レスポンス）と `type: 'event'`（プッシュ通知）の 2 種類。

**主要ファイル**:

| ファイル | 役割 |
|---|---|
| `shared/types.ts` | `RecursiveMethodKeys`, `PathValue`, `ExtractMethod` 等の型定義 |
| `browser/createElectronApi.ts` | プリロード側: `useChannelAsInvoke` / `useChannelAsEvent` で API を生成 |
| `main/createRegisterIpc.ts` | メイン側: `ipcMain.handle`（invoke）/ `webContents.send`（event）で登録 |
| `shared/createResponseChannel.ts` | イベント型のレスポンスチャネル名生成（`channel::response`） |
| `browser/deepMerge.ts` | 複数 API モジュールの定義をマージ |

### IPC API モジュールの追加手順

新しい API モジュール（例: `foo`）を追加する手順:

1. **API 型と IPC 定義を作成**: `electron/main/api/foo.ts`
   - API 型（`FooApi`）を定義する。
   - `createRegisterIpc` に渡す定義オブジェクト（`type: 'invoke'` / `'event'` のエントリ）を作成する。
2. **Context に追加**: `electron/main/index.ts` の `createWindowContext()` に `foo` サブコンテキストを追加する。
3. **IPC 登録に追加**: `electron/main/ipc/registerIpc.ts` で新モジュールの定義をマージする。
4. **プリロードに追加**: `electron/main/ipc/electronApi.ts` で `createElectronApi` の定義に追加する。
5. **レンダラー API に追加**: `src/api.ts` に Electron / ブラウザ両対応の API を追加する。

**現在の API モジュール（7 つ）**:

| モジュール | 主な機能 |
|---|---|
| `auth` | login / logout / getSession |
| `aiChat` | sendMessage（ストリーミング）、chunk イベント |
| `mcp` | startServer / stopServer |
| `kakeibo` | getExpenses（SQLite ビュー） |
| `fs` | readFileAsText, writeFile, showOpenDialog 等（計 10 メソッド） |
| `theme` | setTheme、on.updated イベント |
| `web` | findInPage、on.focus / on.blur イベント |

### プリロードとレンダラー API

- **プリロード** (`electron/preload/index.ts`): `contextBridge.exposeInMainWorld` で `window.api` を公開する。
- **レンダラー API** (`src/api.ts`): Electron 環境では `window.api` を使い、ブラウザ環境ではモック/エラーにフォールバックする。レンダラーコードは `src/api.ts` 経由で呼び出す。
- **型宣言** (`electron/electron-env.d.ts`): Window インターフェースに `api` プロパティを宣言。

**重要**: レンダラーから Electron モジュールを直接インポートしてはならない。必ず `window.api` / `src/api.ts` を経由する。

### 認証

- **完全オフライン**: `app.getPath('userData')/auth.db` に SQLite で保存。
- **パスワード**: `crypto.scrypt` でハッシュ化、ランダムソルト、`timingSafeEqual` で比較。
- **セッション**: `auth_sessions` テーブル、`is_current` フラグで管理。有効期限 10 年。
- **自動登録**: 初回ログイン時にユーザーが存在しなければ自動作成。
- **AuthRuntime パターン**: `dispose()` で DB 接続を解放。
- **ルートガード**: TanStack Router の `beforeLoad` で `/(app)/` レイアウトルートを保護。未認証時は `/login` にリダイレクト。

### AI チャットとツール

- **ライブラリ**: `@tanstack/ai` + `@tanstack/ai-ollama` + `@tanstack/ai-react`。
- **ストリーミング**: メインプロセスが Ollama API を呼び出し、`aiChat.on.chunk` イベントでチャンクをレンダラーに逐次送信。UUID でリクエストを相関。
- **ConnectionAdapter**: `src/lib/fetchIpcEvents.ts` に TanStack AI 用のカスタム実装（AsyncQueue パターン）。

**ツール追加手順**:

1. `electron/main/features/chat/tools/definitions.ts` にツール定義を追加（`toolDefinition()` + Zod スキーマ）。
2. `electron/main/features/chat/tools/tools.ts` にサーバー実装を追加（`.server()` でハンドラーを登録）。
3. `electron/main/api/aiChat.ts` の `createTools` 内でツールを配列に追加する。

**現在のツール**:
- `switch_theme_dark` / `switch_theme_light`: テーマ切り替え（サーバーサイド）。
- `clock`: 現在時刻を返す（クライアントサイド）。
- `search_project_detail`: RAG 検索（サーバーサイド）。
- MCP 経由のツール（動的ロード）。

### データベース

| 用途 | ライブラリ | ファイルパス | 備考 |
|---|---|---|---|
| アプリデータ（家計簿等） | better-sqlite3 | `data/kakeibo.db` | `DataBase` ラッパークラス経由 |
| 認証 | node:sqlite (`DatabaseSync`) | `userData/auth.db` | 動的 import で読み込み |
| RAG embedding | node:sqlite (`DatabaseSync`) | `data/example.db` | RAG ライブラリ内蔵ハンドラー |

- `data/` 配下のマイグレーション: `0001_init.sql`, `0002_sample.sql`。
- `electron-builder.json5` の `extraResources` で DB ファイルを asar 外に配置する。better-sqlite3 は asar 内のファイルにアクセスできないため。
- `electron/main/infra/paths.ts` で dev / prod / asar 環境のパス解決を統一的に処理する。

### RAG ライブラリ

`electron/shared/lib/rag/` に Ollama embedding を使った RAG を実装。

- `ingest.ts`: テキスト → チャンク分割 → embedding → ストレージ保存。
- `retrieve.ts`: クエリ → embedding → コサイン類似度 → top-K 返却。
- ストレージ/ローダーはプラグイン方式。`node:sqlite` のデフォルト実装が内蔵されている。
- `scripts/rag/` にサンプルスクリプトとテストデータ（`example.txt`）がある。

### MCP（Model Context Protocol）

- Express HTTP サーバーで `@modelcontextprotocol/sdk` の `StreamableHTTPServerTransport` を使用。
- デフォルトポート 3030。チャットを開くと自動起動。
- `electron/shared/lib/tanstack-ai-mcp/index.ts` の `mcpToTanStackAiTools` で MCP ツールを TanStack AI 形式に変換。

---

## セキュリティ制約

以下はエージェントが変更してはならないセキュリティ設定である。

### BrowserWindow 設定

```
contextIsolation: true    // プリロードとレンダラーのコンテキスト分離
nodeIntegration: false    // レンダラーから Node.js API へのアクセス禁止
sandbox: true             // レンダラープロセスのサンドボックス化
webviewTag: false         // webview タグの使用禁止
```

### ナビゲーションポリシー

- 許可されていない URL へのナビゲーションをブロックする。
- `window.open` による新規ウィンドウ作成は常に拒否する。

### IPC

- レンダラーから Electron モジュールを直接インポートしない。`window.api` / `src/api.ts` 経由のみ。
- IPC ハンドラーではシリアライズ可能なエラーのみスローする。生のオブジェクトをスローしない。

### パスワード

- `crypto.scrypt` + ランダムソルト + `timingSafeEqual`。これらの実装を弱体化させない。

---

## ツーリング設定

### TypeScript (`tsconfig.json`)

- `strict: true`
- `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`: 有効
- `moduleResolution: bundler`, `verbatimModuleSyntax: true`
- `allowImportingTsExtensions: true`
- `noUncheckedSideEffectImports: true`（副作用インポートは明示的に管理）

### ESLint (`eslint.config.js`)

- ベース: `@tanstack/eslint-config`
- `eslint-plugin-react-hooks` 有効。
- React Compiler 互換: `eslint-plugin-use-no-memo` 有効。
  - `use-no-memo/react-hook-form`: error
  - `use-no-memo/tanstack-table`: error
- ESLint 対象外パス:
  - `dist-electron/**`
  - `src/components/ui/**`（ベンダーコード）
  - `src/lib/utils.ts`
  - `src/features/ui-demo/**`
  - `electron/**`（lint 対象外だがコードは清潔に保つこと）

### Prettier (`prettier.config.js`)

- `semi: false`
- `singleQuote: true`
- `trailingComma: all`

### EditorConfig (`.editorconfig`)

- インデント: スペース
- 改行コード: LF
- ファイル末尾に改行: 必須

---

## コードスタイルガイドライン

### インポート

- ESM インポートを使用する（`"type": "module"`）。
- 型のみのインポートには `import type { ... } from '...'` を使う。
- グループ順序:
  1. Node.js 組み込み（`node:path` 等）
  2. 外部パッケージ
  3. 内部エイリアス（`@/`, `#/`）
  4. 相対インポート
  5. 副作用インポート（CSS）— 最後
- レンダラーコードでは `@/` を、Electron コードでは `#/` を優先する。

### フォーマット

- Prettier に任せる。手動フォーマットは行わない。
- 長い引数や JSX プロパティは複数行に折り返すスタイルが一般的。

### 型と API 境界

- 境界では型を明示する:
  - IPC API（`electron/shared/lib/ipc/**`）
  - feature モジュールの公開関数
  - Electron メインからレンダラーに返すデータ
- 信頼できない入力には `unknown` を使い、`any` は避ける。必要に応じてナローイングする。
- 非同期戻り値の型導出には `Awaited<ReturnType<...>>` を使う（`src/api.ts` で使用例あり）。

### 命名規則

| 対象 | スタイル | 例 |
|---|---|---|
| React コンポーネント | PascalCase | `DemoTable` |
| フック | useX | `useAuth` |
| 関数・変数 | camelCase | `createWindow` |
| 型・インターフェース | PascalCase | `AppContext` |
| 定数（真に不変） | SCREAMING_SNAKE_CASE | `AI_CHAT_API_KEY` |
| その他の定数 | camelCase | `modelSchema` |

### React Compiler / "use no memo" ディレクティブ

React Compiler（Babel 経由）はソースマップなしビルドで有効になる。

TanStack Table（`useReactTable`）や React Hook Form（`useForm` 等）を使うコンポーネントで
ESLint エラーが出た場合、関数本体の先頭にディレクティブを追加する:

```ts
function MyComponent() {
  'use no memo'
  // ...
}
```

- lint ルール無効化よりもディレクティブを優先する。
- 無効化する場合はスコープを最小にし、理由をコメントに書く。

### エラーハンドリング

- 境界ではアクション可能なメッセージとともに早期に失敗する。
- Electron メインでは IO / 初期化を `try/catch` で囲み、コンテキスト付きでログしてから再スローする。
- IPC ハンドラーではシリアライズ可能なエラーのみスローする。

### 副作用インポート

- `noUncheckedSideEffectImports` を満たすため、副作用インポートは避ける。
- 許可される副作用: アプリエントリポイントと CSS。
  - `src/main.tsx` の `./styles.css`, `./custom.css` インポート。

---

## テスト規約

- Vitest（`vite.config.ts` で設定）:
  - 環境: `jsdom`
  - `globals: true`（`describe`, `it`, `expect` をインポート不要で使用可能）
- テストファイル命名: `*.test.ts`, `*.test.tsx`
- React コンポーネントテストには `@testing-library/react` を使用する。
- フェイクタイマーを使った場合は必ず `vi.useRealTimers()` で復元する。

---

## 触れてはいけないもの

- **生成物**: `dist/`, `dist-electron/`, `release/` をコミットしない。
- **ベンダー UI**: `src/components/ui/**` は shadcn/ui のベンダーコード。直接編集せず、ラッパーコンポーネントで拡張する。
- **自動生成ファイル**: `src/routeTree.gen.ts` は TanStack Router が自動生成する。手動編集しない。
- **セキュリティ設定**: 上記「セキュリティ制約」セクションの設定を緩めない。

---

## このファイルの保守方針

### エージェントへの指示

アーキテクチャに影響する変更（新モジュール追加、IPC API 変更、ディレクトリ構造変更、ツーリング設定変更等）を
行った場合、**このファイルの該当箇所も同じコミットまたは同じ PR 内で更新すること**。

具体的には以下のタイミングで更新する:

- IPC API モジュールを追加・変更した → 「IPC API モジュールの追加手順」「現在の API モジュール」テーブルを更新
- チャットツールを追加した → 「現在のツール」リストを更新
- DB を追加した → 「データベース」テーブルを更新
- `tsconfig.json` / `eslint.config.js` / `prettier.config.js` を変更した → 「ツーリング設定」を更新
- pnpm scripts を変更した → 「コマンド」テーブルを更新
- ディレクトリ構造を変更した → 「ディレクトリ構造」ツリーを更新

### 記述原則

- **規範的（prescriptive）な内容に絞る**: 「何をどう書くべきか」「何をしてはいけないか」を明確にする。
- **記述的（descriptive）な解説は最小限**: コードを正しく書くために必要な範囲に留め、全機能の詳細解説は別ドキュメント（例: `scripts/rag/example.txt`）に任せる。
- **具体例を含める**: コマンド例・コード片・テーブルを使い、曖昧さを排除する。
- **落とし穴を優先**: エージェントが判断を誤りやすいポイント（セキュリティ制約、IPC の流れ、asar の制限等）を手厚く書く。

### 言語

- 本文は日本語で記述する。コマンド例・コード片・パス名・技術用語は英語のまま。
