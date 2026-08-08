// Ctrl+K global command search — jump to pages, members, tables, items.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  Grid3x3,
  LayoutDashboard,
  Package,
  Search,
  User,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClub } from '../context/ClubContext'
import { formatCurrency } from '../lib/format'
import { Modal } from './ui'

interface SearchHit {
  icon: LucideIcon
  group: string
  label: string
  sub?: string
  to: string
}

const QUICK_PAGES: Array<{ match: string; label: string; to: string; staffOk: boolean }> = [
  { match: 'tables table live billing', label: 'Tables · live billing', to: '/tables', staffOk: true },
  { match: 'players members all', label: 'All Players / Members', to: '/players', staffOk: true },
  { match: 'due desk dues collect', label: 'Due Desk · collections', to: '/due-desk', staffOk: true },
  { match: 'item billing counter cafe', label: 'Item Billing · counter', to: '/items', staffOk: true },
  { match: 'item bills receipts', label: 'Item Bills · history', to: '/item-bills', staffOk: true },
  { match: 'tournaments tournament events bracket league', label: 'Tournaments', to: '/tournaments', staffOk: true },
  { match: 'frames history bills', label: 'Frames · bill history', to: '/frames', staffOk: true },
  { match: 'logs activity', label: 'Activity Logs', to: '/logs', staffOk: true },
  { match: 'day close closing daily account', label: 'Day Close · daily accounts', to: '/day-close', staffOk: false },
  { match: 'monthly revenue admin sheet', label: 'Monthly Revenue Sheet', to: '/admin', staffOk: false },
  { match: 'finance pnl profit loss balance', label: 'Finance · P&L', to: '/finance', staffOk: false },
  { match: 'expenses spend', label: 'Expenses', to: '/expenses', staffOk: false },
  { match: 'team staff handlers', label: 'Club Staff · team', to: '/team', staffOk: false },
  { match: 'settings configuration pricing', label: 'Settings', to: '/settings', staffOk: true },
  { match: 'human support help contact master admin call whatsapp email', label: 'Human Support · contact', to: '/support', staffOk: true },
  { match: 'privacy policy data legal deletion', label: 'Privacy & Policy', to: '/privacy', staffOk: true },
  { match: 'terms conditions agreement legal liability', label: 'Terms & Conditions', to: '/terms', staffOk: true },
]

export default function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth()
  const { data } = useClub()
  const navigate = useNavigate()
  const setOpen = onOpenChange
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
        setQ('')
        setActive(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpenChange, open])

  const hits = useMemo<SearchHit[]>(() => {
    const isStaff = user?.role === 'staff'
    const query = q.trim().toLowerCase()
    const pages = QUICK_PAGES.filter((p) => !isStaff || p.staffOk)
      .filter((p) => !query || p.match.includes(query) || p.label.toLowerCase().includes(query))
      .slice(0, query ? 3 : 5)
      .map((p) => ({ icon: LayoutDashboard, group: 'Go to', label: p.label, to: p.to }))

    if (!data || !query) return pages

    const members = (data.members ?? [])
      .filter((m) => m.active !== false)
      .filter((m) => m.name.toLowerCase().includes(query) || (m.phone || '').includes(query.replace(/\s/g, '')))
      .slice(0, 5)
      .map((m) => ({
        icon: User,
        group: 'Members',
        label: m.name,
        sub: [
          m.phone || 'no phone',
          (m.dueAmount ?? 0) > 0 ? `due ${formatCurrency(m.dueAmount)}` : null,
          (m.walletBalance ?? 0) > 0 ? `wallet ${formatCurrency(m.walletBalance)}` : null,
        ].filter(Boolean).join(' · '),
        to: (m.dueAmount ?? 0) > 0 ? `/due-desk?q=${encodeURIComponent(m.name)}` : `/players?q=${encodeURIComponent(m.name)}`,
      }))

    const tables = (data.tables ?? [])
      .filter((t) => t.name.toLowerCase().includes(query))
      .slice(0, 3)
      .map((t) => ({
        icon: Grid3x3,
        group: 'Tables',
        label: t.name,
        sub: `${formatCurrency(t.rate.hourlyRate)}/hr${t.active !== false ? '' : ' · disabled'}`,
        to: '/tables',
      }))

    const items = (data.menuItems ?? [])
      .filter((i) => i.name.toLowerCase().includes(query))
      .slice(0, 4)
      .map((i) => ({
        icon: Package,
        group: 'Menu Items',
        label: i.name,
        sub: `${formatCurrency(i.price)} · ${i.stockQty} in stock${(i.stockQty ?? 0) <= (i.reorderLevel ?? 5) ? ' · LOW' : ''}`,
        to: '/items',
      }))

    const bills = (data.itemBills ?? [])
      .filter((b) => b.customerName.toLowerCase().includes(query) || (b.memberName || '').toLowerCase().includes(query))
      .slice(0, 3)
      .map((b) => ({
        icon: CalendarCheck,
        group: 'Item Bills',
        label: b.customerName,
        sub: `${formatCurrency(b.total)} · ${b.status}${b.dueAmount > 0 ? ` · due ${formatCurrency(b.dueAmount)}` : ''}`,
        to: `/item-bills?q=${encodeURIComponent(b.customerName)}`,
      }))

    const tours: SearchHit[] = []
    return [...pages, ...members, ...tables, ...items, ...bills, ...tours]
  }, [q, data, user?.role])

  useEffect(() => {
    setActive(0)
  }, [q, hits.length])

  const go = (hit: SearchHit) => {
    setOpen(false)
    setQ('')
    navigate(hit.to)
  }

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(hits.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault()
      go(hits[active])
    }
  }

  useEffect(() => {
    listRef.current
      ?.querySelector('.gs-row.active')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  let lastGroup = ''

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Quick Search" width={480}>
      <div className="gs-box">
        <div className="gs-input-row">
          <Search size={14} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Member, table, item, bill ya page…"
            aria-label="Global search"
          />
          <span className="gs-kbd">Ctrl K</span>
        </div>
        <div className="gs-list" ref={listRef}>
          {hits.length === 0 ? (
            <p className="muted small" style={{ padding: '8px 4px' }}>Nothing found — check the spelling.</p>
          ) : (
            hits.map((h, i) => {
              const showGroup = h.group !== lastGroup
              lastGroup = h.group
              const Icon = h.icon
              return (
                <div key={`${h.group}-${h.label}-${i}`}>
                  {showGroup && <div className="gs-group">{h.group}</div>}
                  <button
                    className={`gs-row${i === active ? ' active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                  >
                    <Icon size={13} />
                    <span className="gs-label">{h.label}</span>
                    {h.sub && <span className="gs-sub">{h.sub}</span>}
                    <ArrowRight size={11} className="gs-go" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}
