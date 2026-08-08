// Topbar alerts dropdown — low stock, due-limit pressure, expiring plans.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, ChevronRight, PackageX, Scale, type LucideIcon } from 'lucide-react'
import { useClub } from '../context/ClubContext'
import { formatCurrency, formatDate } from '../lib/format'

interface ClubAlert {
  icon: LucideIcon
  tone: 'red' | 'gold' | 'blue'
  title: string
  sub: string
  to: string
}

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export default function AlertsBell() {
  const { data } = useClub()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const alerts = useMemo<ClubAlert[]>(() => {
    if (!data) return []
    const out: ClubAlert[] = []
    const menu = data.menuItems ?? []
    const members = data.members ?? []
    const stats = data.stats

    // low stock vs per-item reorder level
    const low = menu.filter((m) => m.active !== false && (m.stockQty ?? 0) <= (m.reorderLevel ?? 5))
    if (low.length > 0) {
      out.push({
        icon: PackageX,
        tone: 'red',
        title: `Low stock · ${low.length} item${low.length > 1 ? 's' : ''}`,
        sub: low.slice(0, 3).map((m) => `${m.name} (${m.stockQty})`).join(', ') + (low.length > 3 ? ` +${low.length - 3}` : ''),
        to: '/items',
      })
    }

    // due-limit pressure
    const limit = stats?.dueLimit ?? 0
    const due = stats?.totalDue ?? 0
    if (limit > 0 && due >= limit * 0.7) {
      out.push({
        icon: Scale,
        tone: due >= limit ? 'red' : 'gold',
        title: due >= limit ? 'Due limit crossed' : 'Due limit almost reached',
        sub: `${formatCurrency(due)} of ${formatCurrency(limit)} is still uncollected`,
        to: '/due-desk',
      })
    }

    // premium plans expiring in 7 days
    const soon = Date.now() + SEVEN_DAYS
    const expiring = members.filter(
      (m) =>
        m.active !== false &&
        m.planExpiresAt &&
        new Date(m.planExpiresAt).getTime() > Date.now() &&
        new Date(m.planExpiresAt).getTime() <= soon,
    )
    if (expiring.length > 0) {
      out.push({
        icon: CalendarClock,
        tone: 'blue',
        title: `${expiring.length} premium plan${expiring.length > 1 ? 's' : ''} expiring ≤7 din`,
        sub: expiring
            .slice(0, 3)
            .map((m) => `${m.name} · ${formatDate(m.planExpiresAt)}`)
            .join(' · ') + (expiring.length > 3 ? ` +${expiring.length - 3}` : ''),
        to: '/players',
      })
    }
    return out
  }, [data])

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <div className="alerts-wrap">
      <button
        className="btn-icon alerts-btn"
        aria-label={alerts.length > 0 ? `${alerts.length} alerts` : 'No alerts'}
        title={alerts.length > 0 ? `${alerts.length} alerts` : 'No alerts'}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={15} />
        {alerts.length > 0 && <span className="alert-count">{alerts.length}</span>}
      </button>
      {open && (
        <>
          <div className="alerts-backdrop" onClick={() => setOpen(false)} />
          <div className="alerts-panel" role="menu">
            <div className="alerts-head">Alerts · {alerts.length}</div>
            {alerts.length === 0 ? (
              <p className="muted small" style={{ padding: '10px 12px' }}>All clear — nothing needs attention today 👍</p>
            ) : (
              alerts.map((a, i) => {
                const Icon = a.icon
                return (
                  <button key={i} className={`alert-row alert-${a.tone}`} role="menuitem" onClick={() => go(a.to)}>
                    <Icon size={13} className={`alert-ic-${a.tone}`} />
                    <span className="alert-text">
                      <b>{a.title}</b>
                      <span className="muted small">{a.sub}</span>
                    </span>
                    <ChevronRight size={12} className="alert-chevron" />
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
