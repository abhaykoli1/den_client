// Central REST client: base URL, bearer token, typed errors, 401 handling.
import { clearToken, getToken } from './storage'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
export const DEV_MODE = String(import.meta.env.VITE_AUTH_DEV_MODE).toLowerCase() === 'true'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body } = opts
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Network error — is the backend running?')
  }

  let data: any = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    const detail = data?.detail
    let message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d?.msg || String(d)).join('; ')
          : res.status === 401
            ? 'Your session expired — please sign in again'
            : `Request failed (${res.status})`
    // Generic/proxy 401s ("Authentication required", empty detail) confuse
    // owners — always surface one friendly, actionable message.
    if (res.status === 401 && (message === 'Authentication required' || !detail)) {
      message = 'Your session expired — please sign in again'
    }
    // Common platform-level failures → one clear line instead of a code.
    if (res.status === 413) message = 'Request too large — try a smaller image'
    if (res.status === 429) message = 'Too many requests — wait a moment and try again'
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      message = 'Server is waking up — wait ~10 seconds and try again'
    }
    if (res.status === 401 && token) {
      clearToken()
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
    throw new ApiError(res.status, message)
  }
  return data as T
}

// ---- normalization helpers (defensive defaults around raw API JSON) ----

export function asArray<T = any>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

export function asNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function normClubData(raw: any): import('../types').ClubData {
  const sessions = asArray<any>(raw?.sessions).map((s) => ({
    ...s,
    matchMode: s?.matchMode === '2v2' ? '2v2' : 'solo',
    players: asArray(s?.players),
    items: asArray(s?.items),
  }))
  const frames = asArray<any>(raw?.frames).map((f) => ({
    ...f,
    matchMode: f?.matchMode === '2v2' ? '2v2' : 'solo',
    players: asArray(f?.players),
    items: asArray(f?.items),
    winners: asArray(f?.winners),
    losers: asArray(f?.losers),
    settlements: asArray(f?.settlements),
  }))
  return {
    club: raw?.club ?? null,
    tables: asArray(raw?.tables).map((t: any) => ({ ...t, active: t?.active !== false })),
    members: asArray(raw?.members).map((m: any) => ({ ...m, active: m?.active !== false })),
    plans: asArray(raw?.plans).map((p: any) => ({ ...p, active: p?.active !== false })),
    sessions,
    frames,
    menuItems: asArray(raw?.menuItems).map((i: any) => ({
      ...i,
      active: i?.active !== false,
      costPrice: asNum(i?.costPrice),
      stockQty: i?.stockQty == null ? 0 : asNum(i?.stockQty),
    })),
    itemBills: asArray(raw?.itemBills),
    expenses: asArray(raw?.expenses),
    membershipSales: asArray(raw?.membershipSales),
    logs: asArray(raw?.logs),
    stats: raw?.stats ?? null,
  }
}
