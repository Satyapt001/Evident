import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import * as authApi from '@/api/auth'
import { ApiError, onUnauthorized, tokenStore } from '@/api/client'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'

type Phase = 'checking' | 'signed-out' | 'signed-in' | 'unreachable'

interface AuthContextValue {
  phase: Phase
  user: authApi.User | null
  signIn: (email: string, password: string, remember: boolean) => Promise<void>
  setup: (payload: { organization: string; name: string; email: string; password: string }, remember: boolean) => Promise<void>
  signOut: () => Promise<void>
  retry: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(tokenStore.get() ? 'checking' : 'signed-out')
  const [user, setUser] = useState<authApi.User | null>(null)

  const restore = useCallback(async () => {
    if (!tokenStore.get()) { setPhase('signed-out'); return }
    setPhase('checking')
    try {
      setUser(await authApi.getMe())
      setPhase('signed-in')
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) { setPhase('unreachable'); return } // keep the token; backend may be restarting
      tokenStore.clear()
      setUser(null)
      setPhase('signed-out')
    }
  }, [])

  useEffect(() => { void restore() }, [restore])

  // A 401 from any protected call (expired or revoked session) returns the person to sign-in.
  useEffect(() => {
    onUnauthorized(() => { setUser(null); setPhase('signed-out') })
    return () => onUnauthorized(null)
  }, [])

  const accept = useCallback((res: authApi.TokenResponse, remember: boolean) => {
    tokenStore.set(res.access_token, remember)
    setUser(res.user)
    setPhase('signed-in')
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    phase,
    user,
    signIn: async (email, password, remember) => accept(await authApi.login(email, password), remember),
    setup: async (payload, remember) => accept(await authApi.setupConsole(payload), remember),
    signOut: async () => {
      try { await authApi.logoutRequest() } catch { /* the local session ends either way */ }
      tokenStore.clear()
      setUser(null)
      setPhase('signed-out')
    },
    retry: () => void restore(),
  }), [phase, user, accept, restore])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

/** Wrap protected routes. Sends signed-out visitors to /login and returns them afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { phase, retry } = useAuth()
  const location = useLocation()

  if (phase === 'checking') return <div className="auth-fill"><LoadingState label="VERIFYING SESSION" /></div>
  if (phase === 'unreachable') {
    return <div className="auth-fill"><ErrorState title="BACKEND UNREACHABLE" message="Your session is saved, but the CYBERGUARD backend did not respond. Start it, then retry." onRetry={retry} /></div>
  }
  if (phase === 'signed-out') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}
