/// <reference types="vite-plugin-electron/electron-env" />

// Used in Renderer process, expose in `preload/index.ts`
interface Window {
  api: import('#/main/ipc/electronApi').ElectronApi
}
