import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api, ApiError } from '../lib/api'
import { clearToken, getToken, setToken } from '../lib/storage'
import { useToast } from './ToastContext'
import type { AccountSubscription, AppUser } from '../types'

export type AuthStatus = 'loading' | 'guest' | 'authed'

/** Client-side mirror of the backend subscription gate (backend enforces). */
export function subscriptionOk(sub?: AccountSubscription | null): boolean {
  if (!sub) return false
  if (sub.status !== 'trial' && sub.status !== 'active') return false
  if (sub.expiresAt) {
    const t = new Date(sub.expiresAt).getTime()
    if (Number.isFinite(t) && t <= Date.now()) return false
  }
  return true
}

export function hasAppAccess(user: AppUser | null): boolean {
  if (!user) return false
  if (user.role === 'master') return true
  return subscriptionOk(user.subscription)
}

interface AuthCtx {
  status: AuthStatus
  user: AppUser | null
  googleLogin: (credential: string) => Promise<void>
  devLogin: (email: string, name?: string) => Promise<boolean>
  logout: () => void
  refreshUser: () => Promise<void>
  /** PATCH /auth/me — phone/location/(name) on the login account. */
  updateProfile: (body: { name?: string; phone?: string; location?: string }) => Promise<boolean>
  loginError: string | null
  busy: boolean
  setLoginError: (msg: string | null) => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [status, setStatus] = useState<AuthStatus>(getToken() ? 'loading' : 'guest')
  const [user, setUser] = useState<AppUser | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const userRef = useRef<AppUser | null>(null)
  userRef.current = user

  const finishLogin = useCallback(
    (payload: { user: AppUser; token: string }) => {
      setToken(payload.token)
      setUser(payload.user)
      setStatus('authed')
      setLoginError(null)
      toast.success(`Signed in · ${payload.user.name}`)
    },
    [toast],
  )

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setStatus('guest')
    setLoginError(null)
    toast.success('Signed out')
  }, [toast])

  useEffect(() => {
    let cancelled = false
    if (!getToken()) return
    api<AppUser>('/auth/me')
      .then((u) => {
        if (cancelled) return
        setUser(u)
        setStatus('authed')
      })
      .catch(() => {
        if (cancelled) return
        clearToken()
        setStatus('guest')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      if (!userRef.current) return
      setUser(null)
      setStatus('guest')
      toast.error('Session expired — please sign in again')
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [toast])

  const googleLogin = useCallback(
    async (credential: string) => {
      setBusy(true)
      setLoginError(null)
      try {
        const payload = await api<{ user: AppUser; token: string }>('/auth/google', {
          method: 'POST',
          body: { credential },
        })
        finishLogin(payload)
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Google sign-in failed'
        setLoginError(msg)
        toast.error(msg)
      } finally {
        setBusy(false)
      }
    },
    [finishLogin, toast],
  )

  const devLogin = useCallback(
    async (email: string, name?: string) => {
      if (!email.trim()) {
        setLoginError('Email is required')
        return false
      }
      setBusy(true)
      setLoginError(null)
      try {
        const payload = await api<{ user: AppUser; token: string }>('/auth/dev', {
          method: 'POST',
          body: { email: email.trim(), name: name?.trim() || undefined },
        })
        finishLogin(payload)
        return true
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Sign-in failed'
        setLoginError(msg)
        toast.error(msg)
        return false
      } finally {
        setBusy(false)
      }
    },
    [finishLogin, toast],
  )

  const refreshUser = useCallback(async () => {
    try {
      const u = await api<AppUser>('/auth/me')
      setUser(u)
    } catch {
      /* 401 path handled globally */
    }
  }, [])

  const updateProfile = useCallback(
    async (body: { name?: string; phone?: string; location?: string }) => {
      try {
        const fresh = await api<AppUser>('/auth/me', { method: 'PATCH', body })
        setUser(fresh)
        toast.success('Profile saved')
        return true
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Could not save profile')
        return false
      }
    },
    [toast],
  )

  const value = useMemo<AuthCtx>(
    () => ({ status, user, googleLogin, devLogin, logout, refreshUser, updateProfile, loginError, busy, setLoginError }),
    [status, user, googleLogin, devLogin, logout, refreshUser, updateProfile, loginError, busy],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
