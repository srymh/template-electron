import { URL, fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import electron from 'vite-plugin-electron/simple'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    devtools(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    viteReact({
      // https://github.com/facebook/react/issues/33057
      // https://github.com/TanStack/table/issues/5567
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
    electron({
      main: {
        // `build.lib.entry` のショートカット。
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'better-sqlite3',
                '@openai/agents',
                '@openai/agents-core',
                'openai',
              ],
            },
          },
        },
      },
      preload: {
        // `build.rollupOptions.input` のショートカット。
        // Preload スクリプトは Web アセットを含む場合があるため、`build.lib.entry` ではなく `build.rollupOptions.input` を使用します。
        input: path.join(__dirname, 'electron/preload.ts'),
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
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
