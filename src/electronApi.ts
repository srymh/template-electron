const isElectron = (window.electronApi as unknown) !== undefined

export type ElectronApi = typeof window.electronApi

export const electronApi: ElectronApi = (() => {
  if (isElectron) {
    return window.electronApi
  } else {
    // Mock implementation for non-Electron environments
    return {
      theme: {
        setTheme: () => Promise.resolve(),
        getTheme: () => Promise.resolve('light' as const),
        getAccentColor: async () => Promise.resolve('ff88ff' as const),
        on: {
          updated: () => () => {},
          accentColorChanged: () => () => {},
        },
      },
    } as unknown as ElectronApi
  }
})()
