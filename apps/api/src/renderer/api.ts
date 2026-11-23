import type { ElectronApi } from '../api'

export type Api = ElectronApi
export type AiChatApi = Api['aiChat']
export type AuthApi = Api['auth']
export type FsApi = Api['fs']
export type ThemeApi = Api['theme']
export type WebApi = Api['web']
export type SecretApi = Api['secret']
export type TodoApi = Api['todo']
export type StorageDemoApi = Api['storageDemo']

type BrowserWindowWithApi = Window & {
  api?: ElectronApi
}

let mockUser: { username: string } | null = null

function getElectronApi(windowObject: BrowserWindowWithApi): ElectronApi | null {
  return windowObject.api ?? null
}

const api: Api = (() => {
  const electronApi = getElectronApi(window)
  if (electronApi) {
    return electronApi
  }

  const notAvailable = (name: string) =>
    new Proxy(
      {},
      {
        get() {
          throw new Error(`[api] '${name}' は Electron 環境でのみ利用可能です。`)
        },
        apply() {
          throw new Error(`[api] '${name}' は Electron 環境でのみ利用可能です。`)
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
    aiChat: notAvailable('aiChat') as AiChatApi,
    auth: {
      getStatus: async () =>
        Promise.resolve({
          isAuthenticated: Boolean(mockUser),
          user: mockUser,
        }),
      login: async (username: string, _password: string) => {
        mockUser = { username }
        return {
          isAuthenticated: true,
          user: mockUser,
        }
      },
      logout: async () => {
        mockUser = null
      },
    },
    fs: notAvailable('fs') as FsApi,
    theme,
    web: notAvailable('web') as WebApi,
    secret: notAvailable('secret') as SecretApi,
    todo: notAvailable('todo') as TodoApi,
    storageDemo: notAvailable('storageDemo') as StorageDemoApi,
  }
})()

// export default api
export const { aiChat, auth, fs, theme, web, secret, todo, storageDemo } = api
