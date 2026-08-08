// Formatting + shared estimation helpers (front-end ESTIMATES only — the
// FastAPI backend always computes the authoritative persisted result).
import type { ClubTable, Member, TableRate } from '../types'

export function formatCurrency(value: number | null | undefined, symbol = '₹'): string {
  const n = Number(value ?? 0)
  const abs = Math.abs(n)
  const text = abs.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
  return `${n < 0 ? '-' : ''}${symbol}${text}`
}

export function formatNumber(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

/** Live clock for timers: 02:14 or 1:02:14 when hours are involved. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** "45m", "1h 30m" — fixed durations for stopped bills / history. */
export function formatDuration(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(minutes ?? 0))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}h ${rest}m` : `${h}h`
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function todayLabel(): string {
  return new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })
}

/** Hour-of-day (0-23) in Indian 12-hour style: 16 → "4 PM", 0 → "12 AM". */
export function formatHour(h: number): string {
  const n = ((Math.round(h) % 24) + 24) % 24
  const mer = n < 12 ? 'AM' : 'PM'
  const hr = n % 12 === 0 ? 12 : n % 12
  return `${hr} ${mer}`
}

/** "4–5 PM" · "11 PM – 12 AM" — compact 12-hour range for peak-hour chips. */
export function formatHourRange(start: number, end: number): string {
  const s = ((Math.round(start) % 24) + 24) % 24
  const e = ((Math.round(end) % 24) + 24) % 24
  const sameMer = s < 12 === e < 12
  if (sameMer) return `${formatHour(s).replace(/ (AM|PM)$/, '')}–${formatHour(e)}`
  return `${formatHour(s)} – ${formatHour(e)}`
}

export function titleCase(s: string): string {
  return (s || '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function parseNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Client-side estimate of the authoritative backend calc (2-dp exact). */
export function calcTableAmount(
  startedAt: string,
  endedAt: string,
  hourlyRate: number,
  minCharge: number,
): { amount: number; minutes: number } {
  const start = new Date(startedAt).getTime()
  const end = new Date(endedAt).getTime()
  const elapsed = Math.max(0, (end - start) / 1000)
  const minutes = Math.max(1, Math.ceil(elapsed / 60))
  const amount = Math.round((hourlyRate / 60) * minutes * 100) / 100
  return { amount: Math.max(amount, minCharge || 0), minutes }
}

export function ratesFor(table: ClubTable, playerCount: number): number {
  const keyed = table?.rate?.ratesByPlayers?.[String(playerCount)]
  if (keyed) return Number(keyed)
  return Number(table?.rate?.hourlyRate || 0)
}

/** Peak hour window check — mirrors the backend resolver (wrap-around aware). */
export function peakWindowActive(rate?: TableRate | null, at = new Date()): boolean {
  const p = rate?.peakHourlyRate
  const s = rate?.peakStartHour
  const e = rate?.peakEndHour
  if (!p || p <= 0 || s == null || e == null || s === e) return false
  const h = at.getHours()
  return s < e ? h >= s && h < e : h >= s || h < e
}

/** Display estimate for the rate a NEW session would get right now. */
export function effectiveRate(table: ClubTable, playerCount: number, at = new Date()): number {
  if (peakWindowActive(table?.rate, at)) return Number(table!.rate.peakHourlyRate)
  return ratesFor(table, playerCount)
}

export function planValid(expiresAt?: string | null): boolean {
  if (!expiresAt) return true
  const t = new Date(expiresAt).getTime()
  return Number.isFinite(t) ? t > Date.now() : false
}

/** Highest valid monthly/premium table discount among the paying side. */
export function maxPayingDiscount(members: Member[], fallbackPct: number): { pct: number; name: string | null } {
  let pct = 0
  let name: string | null = null
  for (const m of members) {
    if ((m.planType || m.type) !== 'monthly') continue
    if (!planValid(m.planExpiresAt)) continue
    const p = m.tableDiscountPercent || fallbackPct || 0
    if (p > pct) {
      pct = p
      name = m.name
    }
  }
  return { pct, name }
}

export function modeBadge(mode?: string | null): string {
  const m = (mode || 'cash').toLowerCase()
  const map: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    wallet: 'Wallet',
    due: 'Due',
    mixed: 'Mixed',
  }
  return map[m] || titleCase(m)
}
