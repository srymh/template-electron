export type ElectronApi = typeof window.api

export const api: ElectronApi = (() => {
  const isElectron = (window.api as unknown) !== undefined

  if (isElectron) {
    return window.api
  } else {
    let mockUser: { username: string } | null = null

    // Mock implementation for non-Electron environments
    return {
      auth: {
        getStatus: async () =>
          Promise.resolve({
            isAuthenticated: Boolean(mockUser),
            user: mockUser,
          }),
        // eslint-disable-next-line @typescript-eslint/require-await
        login: async (username: string, _password: string) => {
          mockUser = { username }
          return {
            isAuthenticated: true,
            user: mockUser,
          }
        },
        // eslint-disable-next-line @typescript-eslint/require-await
        logout: async () => {
          mockUser = null
        },
      },
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
