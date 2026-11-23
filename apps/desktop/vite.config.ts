import { defineConfig } from 'vite'
import { electron } from '@srymh/vite-plugin-electron'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const minify = mode === 'production'
  const sourcemap = mode !== 'production'

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
            build: {
              sourcemap,
              minify,
              outDir: 'dist/main',
            },
            resolve: { tsconfigPaths: true },
          },
        },
        preload: {
          entry: 'src/preload/index.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : false,
              minify,
              outDir: 'dist/preload',
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
