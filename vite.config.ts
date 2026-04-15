import { URL, fileURLToPath } from 'node:url'
import path from 'node:path'
import { rmSync } from 'node:fs'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  rmSync('dist-electron', { recursive: true, force: true })
  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  // pnpm の strict node_modules 構造では、asar 内で推移的依存の解決が
  // 失敗する（例: express → body-parser, ollama → whatwg-fetch）。
  // ネイティブモジュール（.node バイナリを含むもの）のみ external にし、
  // 残りはすべて Vite にバンドルさせることで asar 内の解決問題を回避する。
  const nativeModules = ['better-sqlite3']
  const external = nativeModules

  return {
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
          // `build.lib.entry` のショートカット。
          entry: 'electron/main/index.ts',
          onstart({ startup }) {
            if (process.env.VSCODE_DEBUG) {
              // For `.vscode/.debug.script.mjs`
              console.log('[startup] Electron App')
            } else {
              startup()
            }
          },
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
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
          // `build.rollupOptions.input` のショートカット。
          // Preload スクリプトは Web アセットを含む場合があるため、`build.lib.entry` ではなく `build.rollupOptions.input` を使用します。
          input: path.join(__dirname, 'electron', 'preload', 'index.ts'),
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined,
              minify: isBuild,
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
        // Renderer プロセス用に Electron と Node.js の API をポリフィルします。
        // Renderer プロセスで Node.js を使用したい場合、Main プロセスで `nodeIntegration` を有効にする必要があります。
        // 参照 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
        renderer:
          process.env.NODE_ENV === 'test'
            ? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
              undefined
            : {},
      }),
    ],
    server: process.env.VSCODE_DEBUG
      ? (() => {
          const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
          return {
            host: url.hostname,
            port: +url.port,
          }
        })()
      : undefined,
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
