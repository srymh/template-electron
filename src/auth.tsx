import React from 'react'

export type AuthUser = {
  username: string
}

export type AuthState = {
  isAuthenticated: boolean
  user: AuthUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

type AuthContextValue = {
  auth: AuthState
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

const STORAGE_KEY = 'demo-auth-user'

export function AuthProvider(props: { children: React.ReactNode }) {
  const { children } = props

  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser
        if (parsed.username) {
          setUser({ username: parsed.username })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = React.useCallback(
    async (username: string, _password: string) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const nextUser: AuthUser = { username }
      setUser(nextUser)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser))
    },
    [],
  )

  const logout = React.useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const auth = React.useMemo<AuthState>(() => {
    return {
      isAuthenticated: Boolean(user),
      user,
      login,
      logout,
    }
  }, [login, logout, user])

  if (isLoading) {
    return (
      <div className="h-screen w-full grid place-items-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ auth }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
