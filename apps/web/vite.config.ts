import { defineConfig } from 'vite'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? './' : '/'
  const sourcemap = mode !== 'production'

  // React Compiler を使用するとデバッグ時にブレークポイントが正しく動作しないため、
  // ソースマップを有効にしたい場合には React Compiler を無効化します。
  const reactCompilerPlugin = !sourcemap ? [babel({ presets: [reactCompilerPreset()] })] : []

  return {
    base,
    server: {
      port: 5173,
      strictPort: true,
    },
    plugins: [
      devtools(),
      tanstackRouter({
        target: 'react',
        // true にするとデバッグ時にブレークポイントが正しく動作しないため、
        // sourcemap を有効にしたい場合には自動コード分割を無効化します。
        // autoCodeSplitting: sourcemap ? false : true,
        autoCodeSplitting: sourcemap ? false : true,
      }),
      react(),
      ...reactCompilerPlugin,
      tailwindcss(),
    ],
    clearScreen: false,
    define: {
      __PLATFORM__: JSON.stringify(process.env.TARGET_PLATFORM ?? process.platform),
    },
    resolve: { tsconfigPaths: true },
    test: {
      environment: 'jsdom',
      globals: true,
    },
  }
})
