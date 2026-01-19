import React from 'react'
import { electronApi } from '@/electronApi'

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

export function AuthProvider(props: { children: React.ReactNode }) {
  const { children } = props

  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const status = await electronApi.auth.getStatus()
        if (cancelled) return
        setUser(status.user)
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setUser(null)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const login = React.useCallback(
    async (username: string, password: string) => {
      const status = await electronApi.auth.login(username, password)
      setUser(status.user)
    },
    [],
  )

  const logout = React.useCallback(() => {
    void electronApi.auth.logout()
    setUser(null)
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
