//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import useNoMemo from 'eslint-plugin-use-no-memo'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * `pnpm dlx @eslint/config-inspector` で設定内容を確認できます。
 */

export default [
  /** --------------------------------------------------------------------------
   * ✒️ 無視するファイルやディレクトリを指定します。
   * ------------------------------------------------------------------------ */
  {
    name: 'グローバル無視リスト',
    ignores: [
      '**/*.d.ts',
      'eslint.config.js',
      'prettier.config.js',
      'dist-electron/**',
      'src/components/ui/**',
      'src/lib/utils.ts',
      'src/features/ui-demo/**',
      'electron/**',
      'scripts/**',
    ],
  },

  /** --------------------------------------------------------------------------
   * ✒️ プラグインとルールの設定を追加します。
   * ------------------------------------------------------------------------ */
  {
    name: 'React Compiler 用設定',

    /** ------------------------------------------------------------------------
     * 🔌 プラグインを追加します。
     * ---------------------------------------------------------------------- */
    plugins: {
      /**
       * [1] eslint-plugin-use-no-memo
       *
       * React Compilerの「use no memo」ディレクティブを強制するためのESLintプラグイン
       * です。
       *
       * React Compilerは、Reactコンポーネントを自動的に最適化し、高価な操作をメモ化します。
       * ただし、一部のReactライブラリはこの自動メモ化と互換性がなく、React Compilerの
       * 最適化をオプトアウトするために「use no memo」ディレクティブが必要です。
       *
       * このESLintプラグインは、互換性のないフックを使用している場合に自動的に検出し、
       * ディレクティブを追加するよう警告したり、自動的に修正したりするのに役立ちます。
       *
       * @see https://github.com/longzheng/eslint-plugin-use-no-memo
       */
      'use-no-memo': useNoMemo,

      /**
       * [2] eslint-plugin-react-hooks
       *
       * React Compiler には、最適化できないコードを特定するのに役立つ ESLint ルールが
       * 含まれています。ESLint ルールがエラーを報告する場合、コンパイラによるそのコンポー
       * ネントやフックの最適化がスキップされるという意味です。
       * これは安全です。コンパイラはコードベースの他の部分の最適化を続けるので、すべての
       * 違反をすぐに修正する必要はありません。自分のペースで対処し、最適化されるコンポーネ
       * ントの数を徐々に増やしていってください。
       *
       * @see https://ja.react.dev/learn/react-compiler/installation#eslint-integration
       * @see https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md#installation
       */
      ...reactHooks.configs.flat['recommended-latest'].plugins,
    },

    /** ------------------------------------------------------------------------
     * 🚩 ルールを有効化します。
     * ---------------------------------------------------------------------- */
    rules: {
      /* [1] eslint-plugin-use-no-memo */
      'use-no-memo/react-hook-form': 'error',
      'use-no-memo/tanstack-table': 'error',

      /* [2] eslint-plugin-react-hooks */
      ...reactHooks.configs.flat['recommended-latest'].rules,
    },
  },

  /** --------------------------------------------------------------------------
   * ✒️ TanStack ESLint 設定を適用します。
   * ------------------------------------------------------------------------ */
  ...tanstackConfig,
]
