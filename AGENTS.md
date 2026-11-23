# AGENTS.md

<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## 設計上の決定と注意点

変更するときは、次の判断を崩さないか確かめる。

### 保存先

- 実行環境をまたいで共有する業務データは `~/.your-app-name/app-data/`、Electron 版だけのデータは `~/.your-app-name/electron/` に置く。将来のサーバー版が `app-data/` を共有するためで、`web-server/` はその領域として予約している。
- `app.setPath('userData')` は使わず、Chromium の設定・キャッシュは移動しない。

### AI チャット

- ツール・プロンプト・文書取り込みは desktop が注入し、`apps/api` は特定のツール・secret・保存先を知らない。
- 通信は標準 AG-UI に合わせる。会話と承認待ちは永続化しない。
- 既知の不足: 購読を解除しても main のモデル実行は止まらない。`ingestDocument` は保存に失敗しても reject しない。client ツールは定義と実装の2か所に登録が要り、漏れても型では検出できない。

### 共通 DataTable（`apps/web/src/components/data-table`）

- データを差し替えてもページは保つ。展開・セル選択は `getRowId` がある表だけ保つ（位置 ID は別の行を指し得る）。
- 列の参照は保ち、変わる値は factory の `meta` で渡す。子へは meta ではなく値を props で渡す（React Compiler がヘルパー経由の読み取りを追えず、古い表示が残るため）。factory は描画中に作らない。
- 行の変更キー（`body/row-render-state.ts`）とキャッシュの入力は手で管理する。表示状態を足したらキーと入力も足す。キーの一部の要素と、列フィルターの購読の `options.data` は、外しても自動テストが通るため実画面で確かめる。
- 列のドラッグは dnd-kit の `dragmove` の位置・`actions`・`feedback: 'none'` の動きに依存する。dnd-kit を更新したら `testing/` の DnD スクリプトで確かめ直す。
- `@tanstack/react-pacer` は 1.0 前のため、使う場所を `filter/use-draft-commit.ts` に限る。
- `<colgroup>` は使わない（列幅は見出しのセルにだけ書き、列幅の変更で本文を描き直さない）。
