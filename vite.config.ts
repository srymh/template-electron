import { URL, fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { electron } from '@srymh/vite-plugin-electron'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? './' : '/'
  const minify = mode === 'production'
  const sourcemap = mode !== 'production'

  // pnpm の strict node_modules 構造では、asar 内で推移的依存の解決が
  // 失敗する（例: express → body-parser, ollama → whatwg-fetch）。
  // ネイティブモジュール（.node バイナリを含むもの）のみ external にし、
  // 残りはすべて Vite にバンドルさせることで asar 内の解決問題を回避する。
  const nativeModules = ['better-sqlite3']
  const external = nativeModules

  return {
    base,
    plugins: [
      devtools(),
      tanstackRouter({
        target: 'react',
        // true にするとデバッグ時にブレークポイントが正しく動作しないため、
        // sourcemap を有効にしたい場合には自動コード分割を無効化します。
        // autoCodeSplitting: sourcemap ? false : true,
        autoCodeSplitting: sourcemap ? false : true,
      }),
      viteReact({
        // https://github.com/facebook/react/issues/33057
        // https://github.com/TanStack/table/issues/5567
        // React Compiler を使用するとデバッグ時にブレークポイントが正しく動作しないため、
        // ソースマップを有効にしたい場合には React Compiler を無効化します。
        babel: sourcemap
          ? undefined
          : {
              plugins: ['babel-plugin-react-compiler'],
            },
      }),
      tailwindcss(),
      electron({
        main: {
          entry: 'electron/main/index.ts',
          vite: {
            build: {
              sourcemap,
              minify,
              outDir: 'dist-electron/main',
              rollupOptions: {
                external,
              },
            },
            resolve: {
              alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
                '#': fileURLToPath(new URL('./electron', import.meta.url)),
              },
            },
          },
        },
        preload: {
          entry: path.join(__dirname, 'electron', 'preload', 'index.ts'),
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : false,
              minify,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external,
              },
            },
            resolve: {
              alias: {
                '#': fileURLToPath(new URL('./electron', import.meta.url)),
              },
            },
          },
        },
        renderer: {
          mode: 'internal',
        },
        debug: {
          enabled: true,
          port: 9229,
          rendererPort: 9222,
        },
      }),
    ],
    clearScreen: false,
    define: {
      __PLATFORM__: JSON.stringify(
        process.env.TARGET_PLATFORM ?? process.platform,
      ),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '#': fileURLToPath(new URL('./electron', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
    },
  }
})
