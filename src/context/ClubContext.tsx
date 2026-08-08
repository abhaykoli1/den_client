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
import { api, ApiError, asArray, normClubData } from '../lib/api'
import { getActiveClubId, setActiveClubId } from '../lib/storage'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import type { Club, ClubData, ClubStats } from '../types'

interface MutateOptions {
  method?: 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  toast?: string
}

interface ClubCtx {
  clubs: Club[]
  activeClubId: string | null
  club: Club | null
  data: ClubData | null
  stats: ClubStats | null
  booting: boolean
  refreshing: boolean
  error: string | null
  switchClub: (id: string) => void
  addClub: (name: string) => Promise<boolean>
  refresh: (silent?: boolean) => Promise<void>
  /** Mutating call inside the active club; toasts + auto-refresh afterwards. */
  mutate: <T = any>(path: string, opts?: MutateOptions) => Promise<T | null>
}

const Ctx = createContext<ClubCtx | null>(null)

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth()
  const toast = useToast()
  const [clubs, setClubs] = useState<Club[]>([])
  const [activeClubId, setActive] = useState<string | null>(null)
  const [data, setData] = useState<ClubData | null>(null)
  const [booting, setBooting] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const creatingClub = useRef(false)

  const club = useMemo(
    () => clubs.find((c) => c.id === activeClubId) ?? null,
    [clubs, activeClubId],
  )

  const loadData = useCallback(
    async (clubId: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setRefreshing(true)
      try {
        const raw = await api(`/clubs/${clubId}/data`)
        setData(normClubData(raw))
        setError(null)
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Failed to load club data'
        setError(msg)
      } finally {
        setRefreshing(false)
      }
    },
    [],
  )

  const refresh = useCallback(
    async (silent = true) => {
      if (activeClubId) await loadData(activeClubId, { silent })
    },
    [activeClubId, loadData],
  )

  // ---- load assigned clubs once per user ----
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setBooting(true)
      try {
        let list = asArray<Club>(await api('/clubs'))
        // First-run for an activated owner: create the default Rowdy's Den club.
        if (list.length === 0 && user.role === 'owner' && !creatingClub.current) {
          creatingClub.current = true
          try {
            await api('/clubs', { method: 'POST', body: { name: "Rowdy's Den" } })
            list = asArray<Club>(await api('/clubs'))
          } catch {
            /* plan/subscription edge — surface via banner */
          } finally {
            creatingClub.current = false
          }
        }
        if (cancelled) return
        setClubs(list)
        const wanted = getActiveClubId()
        const found = list.find((c) => c.id === wanted)
        const chosen = found ?? list[0] ?? null
        setActive(chosen ? chosen.id : null)
        if (chosen) setActiveClubId(chosen.id)
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Failed to load clubs')
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // ---- load consolidated data when the active club changes ----
  useEffect(() => {
    setData(null)
    setError(null)
    if (activeClubId) void loadData(activeClubId)
  }, [activeClubId, loadData])

  const switchClub = useCallback(
    (id: string) => {
      if (id === activeClubId) return
      setActiveClubId(id)
      setActive(id)
    },
    [activeClubId],
  )

  const addClub = useCallback(
    async (name: string): Promise<boolean> => {
      if (!name.trim()) {
        toast.error('Club name is required')
        return false
      }
      try {
        const created = await api<Club>('/clubs', { method: 'POST', body: { name: name.trim() } })
        toast.success(`Club created · ${created.name}`)
        setClubs((list) => [...list, created])
        await refreshUser()
        setActiveClubId(created.id)
        setActive(created.id)
        return true
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Could not create club')
        return false
      }
    },
    [toast, refreshUser],
  )

  const mutate = useCallback(
    async <T,>(path: string, opts: MutateOptions = {}): Promise<T | null> => {
      if (!activeClubId) return null
      try {
        // NOTE: never emit a trailing slash here — /clubs/{id}/ gets a 307 from
        // FastAPI and some proxies (Vercel) then drop the Authorization header,
        // which looked like a phantom "Authentication required" on logo save.
        const result = await api<T>(`/clubs/${activeClubId}${path ? `/${path}` : ''}`, {
          method: opts.method ?? 'POST',
          body: opts.body,
        })
        if (opts.toast) toast.success(opts.toast)
        await refresh()
        return result
      } catch (e) {
        // 401 already raises ONE clear toast via the auth:unauthorized handler —
        // stacking the raw API message on top used to double-confuse owners.
        if (!(e instanceof ApiError && e.status === 401)) {
          const msg = e instanceof ApiError ? e.message : 'Action failed'
          toast.error(msg)
        }
        if (e instanceof ApiError && e.status === 402) {
          await refreshUser() // unlock flow flips to onboarding if access is gone
        }
        return null
      }
    },
    [activeClubId, refresh, toast, refreshUser],
  )

  const value = useMemo<ClubCtx>(
    () => ({
      clubs,
      activeClubId,
      club,
      data,
      stats: data?.stats ?? null,
      booting,
      refreshing,
      error,
      switchClub,
      addClub,
      refresh,
      mutate,
    }),
    [clubs, activeClubId, club, data, booting, refreshing, error, switchClub, addClub, refresh, mutate],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useClub(): ClubCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useClub must be used inside ClubProvider')
  return ctx
}
