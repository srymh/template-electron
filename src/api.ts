export type Api = typeof window.api
export type AiAgentApi = Api['aiAgent']
export type AiChatApi = Api['aiChat']
export type AuthApi = Api['auth']
export type FsApi = Api['fs']
export type KakeiboApi = Api['kakeibo']
export type McpApi = Api['mcp']
export type ThemeApi = Api['theme']
export type WebApi = Api['web']

const api: Api = (() => {
  const isElectron = (window.api as unknown) !== undefined
  if (isElectron) {
    return window.api
  }

  let mockUser: { username: string } | null = null

  const notAvailable = (name: string) =>
    new Proxy(
      {},
      {
        get() {
          throw new Error(
            `[api] '${name}' は Electron 環境でのみ利用可能です。`,
          )
        },
        apply() {
          throw new Error(
            `[api] '${name}' は Electron 環境でのみ利用可能です。`,
          )
        },
      },
    ) as unknown

  const theme: {
    theme: Awaited<ReturnType<ThemeApi['getTheme']>>
    accentColor: string
  } & ThemeApi = {
    theme: 'light',
    accentColor: 'ff88ff',
    setTheme({ theme: value }) {
      this.theme = value
      return Promise.resolve()
    },
    getTheme() {
      return Promise.resolve(this.theme)
    },
    getAccentColor() {
      return Promise.resolve(this.accentColor)
    },
    on: {
      updated: () => () => {},
      accentColorChanged: () => () => {},
    },
  }

  // Mock implementation for non-Electron environments
  return {
    aiAgent: notAvailable('aiAgent') as AiAgentApi,
    aiChat: notAvailable('aiChat') as AiChatApi,
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
    fs: notAvailable('fs') as FsApi,
    kakeibo: notAvailable('kakeibo') as KakeiboApi,
    mcp: notAvailable('mcp') as McpApi,
    theme,
    web: notAvailable('web') as WebApi,
  }
})()

// export default api
export const { aiAgent, aiChat, auth, fs, kakeibo, mcp, theme, web } = api
