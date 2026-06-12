import { defineConfig } from 'vite'
import { electron } from '@srymh/vite-plugin-electron'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const minify = mode === 'production'
  const sourcemap = mode !== 'production'

  // pnpm の strict node_modules 構造では、asar 内で推移的依存の解決が
  // 失敗する（例: express → body-parser, ollama → whatwg-fetch）。
  // ネイティブモジュール（.node バイナリを含むもの）のみ external にし、
  // 残りはすべて Vite にバンドルさせることで asar 内の解決問題を回避する。
  // better-sqlite3 は optional driver だが、選択時に native module を
  // asar 外から読み込めるよう external のまま維持する。
  const nativeModules = ['better-sqlite3']
  const external = nativeModules
  const sqliteDriver = process.env.SQLITE_DRIVER ?? ''

  return {
    server: {
      port: 5174,
      strictPort: true,
    },
    plugins: [
      electron({
        main: {
          entry: 'src/main/index.ts',
          vite: {
            define: {
              __SQLITE_DRIVER__: JSON.stringify(sqliteDriver),
            },
            build: {
              sourcemap,
              minify,
              outDir: 'dist/main',
              rolldownOptions: { external },
            },
            resolve: { tsconfigPaths: true },
          },
        },
        preload: {
          entry: 'src/preload/index.ts',
          vite: {
            define: {
              __SQLITE_DRIVER__: JSON.stringify(sqliteDriver),
            },
            build: {
              sourcemap: sourcemap ? 'inline' : false,
              minify,
              outDir: 'dist/preload',
              rolldownOptions: { external },
            },
            resolve: { tsconfigPaths: true },
          },
        },
        renderer: {
          mode: 'external',
          devUrl: 'http://localhost:5173',
        },
        debug: {
          enabled: true,
          port: 9229,
          rendererPort: 9222,
        },
      }),
    ],
    clearScreen: false,
    resolve: { tsconfigPaths: true },
  }
})
