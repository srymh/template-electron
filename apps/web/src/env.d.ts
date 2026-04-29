// Used in Renderer process, expose in `preload/index.ts`
interface Window {
  api: import('your-app-name/api').ElectronApi
}

// Injected by Vite `define` at build time (see vite.config.ts)
declare const __PLATFORM__: string
