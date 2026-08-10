import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  Compass,
  FileText,
  Grid3x3,
  Headset,
  History,
  LogOut,
  Menu,
  Moon,
  PieChart,
  Plus,
  Receipt,
  ReceiptText,
  RefreshCw,
  Scale,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sun,
  Trophy,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import SupportChat from './SupportChat'
import AlertsBell from './AlertsBell'
import GlobalSearch from './GlobalSearch'
import Walkthrough from './Walkthrough'
import { useAuth } from '../context/AuthContext'
import { useClub } from '../context/ClubContext'
import { useTheme } from '../context/ThemeContext'
import { formatCurrency, todayLabel } from '../lib/format'
import { APP_VERSION } from '../lib/version'
import { getItem } from '../lib/storage'
import { Btn, Modal, TextInput, EightBallLoader } from './ui'

type NavEntry = {
  label: string
  icon: LucideIcon
  to?: string
  title?: string
  subtitle?: string
  /** Hide the entry from staff accounts (money-admin surfaces). */
  adminOnly?: boolean
  children?: { to: string; label: string; icon: LucideIcon; title: string; subtitle: string }[]
}

// Page subtitles live HERE (owner's design, v3.12) — screens no longer print
// their own sub-line inside .page-head; Layout renders title + subtitle once.
const NAV: NavEntry[] = [
  { to: '/tables', label: 'Tables', icon: Grid3x3, title: 'Tables', subtitle: 'Live table billing · wallet & due auto-applied' },
  { to: '/players', label: 'All Players', icon: Users, title: 'All Players', subtitle: 'Players, wallets, passes & dues' },
  { to: '/due-desk', label: 'Due Desk', icon: Wallet, title: 'Due Desk', subtitle: 'Manage player dues and payments' },
  { to: '/items', label: 'Item Billing', icon: ShoppingBag, title: 'Item Billing', subtitle: 'Counter sales — cafe, snacks & misc items' },
  { to: '/item-bills', label: 'Item Bills', icon: Receipt, title: 'Item Bills', subtitle: 'Counter item bills · history, receipts & dues' },
  { to: '/tournaments', label: 'Tournaments', icon: Trophy, title: 'Tournaments', subtitle: 'Players & entry fees → knockout → match tables → champion' },
  { to: '/frames', label: 'Frames', icon: History, title: 'Frame Bills', subtitle: 'Frame billing & history · winner corrections re-bill automatically' },
  { to: '/logs', label: 'Logs', icon: Activity, title: 'Activity Logs', subtitle: 'Billing, payments, warnings and admin actions' },
  { to: '/settings', label: 'Settings', icon: Settings, title: 'Settings', subtitle: 'Configure your club settings' },
  // Support + policy pages sit right under Settings; Admin/Master stay pinned bottom.
  { to: '/support', label: 'Human Support', icon: Headset, title: 'Human Support', subtitle: 'Contact support for help' },
  { to: '/privacy', label: 'Privacy & Policy', icon: ScrollText, title: 'Privacy & Policy', subtitle: 'View and manage privacy settings' },
  { to: '/terms', label: 'Terms & Conditions', icon: FileText, title: 'Terms & Conditions', subtitle: 'View and manage terms and conditions' },
  // Admin + Master Admin stay pinned to the very bottom of the sidebar.
  {
    label: 'Admin',
    icon: PieChart,
    adminOnly: true,
    children: [
      { to: '/day-close', label: 'Day Close', icon: ClipboardCheck, title: 'Day Close · daily accounts', subtitle: 'Close the day and reconcile accounts' },
      { to: '/admin', label: 'Monthly Revenue', icon: BarChart3, title: 'Monthly Revenue Sheet', subtitle: 'Money received — frames, item bills, memberships, due collections' },
      { to: '/finance', label: 'Finance', icon: Scale, title: 'Finance · P&L & Balance', subtitle: 'How much came in, went out, and stayed — the month-end account' },
      { to: '/expenses', label: 'Expenses', icon: ReceiptText, title: 'Expenses', subtitle: 'Track and manage club expenses' },
      { to: '/team', label: 'Club Staff', icon: UserCog, title: 'Club Staff · roles & access', subtitle: 'Manage staff roles and permissions' },
    ],
  },
]

function Avatar({ name, picture }: { name: string; picture?: string | null }) {
  if (picture) return <img className="avatar" src={picture} alt={name} referrerPolicy="no-referrer" />
  return <span className="avatar avatar-initial">{(name || '?').slice(0, 1).toUpperCase()}</span>
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { clubs, club, activeClubId, switchClub, addClub, stats, refresh, refreshing, error } = useClub()
  const { theme, toggle } = useTheme()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  // Landing on any page → jump back to the very top (fresh view every time).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [location.pathname])
  const [drawer, setDrawer] = useState(false)
  const [clubModal, setClubModal] = useState(false)
  const [clubName, setClubName] = useState('')
  const [savingClub, setSavingClub] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [tour, setTour] = useState(false)

  // First visit on this device → auto-launch the walkthrough once.
  useEffect(() => {
    if (!user || !club || user.role === 'master') return
    if (getItem('tourDone')) return
    const t = window.setTimeout(() => setTour(true), 700)
    return () => window.clearTimeout(t)
  }, [user, club])

  const current = useMemo(() => {
    for (const n of NAV) {
      if (n.to && location.pathname.startsWith(n.to)) return n
      const child = n.children?.find((c) => location.pathname.startsWith(c.to))
      if (child) return child
    }
    return undefined
  }, [location.pathname])
  const title = location.pathname.startsWith('/master') ? 'Master Admin' : (current?.title ?? 'Tables')
  const subtitle = location.pathname.startsWith('/master')
    ? 'Manage platform-wide administration'
    : current?.subtitle
  const isMasterRoute = location.pathname.startsWith('/master')

  // Admin group is a dropdown — auto-opens when you land on one of its pages.
  const adminActive = NAV.some((n) => n.children?.some((c) => location.pathname.startsWith(c.to)))
  useEffect(() => {
    if (adminActive) setAdminOpen(true)
  }, [adminActive])
  const sub = user?.role === 'master' ? null : user?.subscription
  const clubLimit = sub?.maxClubs ?? 1

  const doAddClub = async () => {
    setSavingClub(true)
    const ok = await addClub(clubName)
    setSavingClub(false)
    if (ok) {
      setClubModal(false)
      setClubName('')
    }
  }

  // Master page keeps its own data pipeline (not ClubContext) — the title-row
  // refresh drops an event; MasterAdminScreen listens and reloads.
  const [maRefreshing, setMaRefreshing] = useState(false)
  useEffect(() => {
    const done = () => setMaRefreshing(false)
    window.addEventListener('rd:refresh-done', done)
    return () => window.removeEventListener('rd:refresh-done', done)
  }, [])
  const doRefresh = async () => {
    if (isMasterRoute) {
      setMaRefreshing(true)
      window.dispatchEvent(new CustomEvent('rd:refresh'))
      return
    }
    await refresh(false)
  }

  return (
    <div className="app-shell">
      {drawer && <div className="sidebar-backdrop" onClick={() => setDrawer(false)} />}
      <aside className={`sidebar${drawer ? ' open' : ''}`}>
        <div className="brand">
          {club?.logo ? (
            <img className="brand-logo" src={club.logo} alt={club.name} />
          ) : (
            <span className="brand-mark" aria-hidden>
              <img src="/public/icons/logo.png" width="34" height="34" alt="Rowdy's Den" />
            </span>
          )}
          <div className="brand-text">
            <div className="brand-name">{club?.name || "Rowdy's Den"}</div>
            <div className="brand-sub">Club Billing</div>
          </div>
          <button className="btn-icon drawer-close" aria-label="Close menu" onClick={() => setDrawer(false)}>
            <X size={14} />
          </button>
        </div>

        {user && (
          <div className="club-switch">
            <span className="field-label">Active Club · {clubs.length}/{user.role === 'master' ? '∞' : clubLimit}</span>
            <div className="club-switch-row">
              <select
                className="input select grow"
                value={activeClubId ?? ''}
                onChange={(e) => switchClub(e.target.value)}
                aria-label="Active club"
              >
                {clubs.length === 0 && <option value="">No clubs yet</option>}
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                className="btn-icon btn-icon-green"
                aria-label="Add club"
                title="Add another club"
                onClick={() => setClubModal(true)}
              >
                <Plus size={14} />
              </button>
            </div>
            {/* today + due mini chips — owner's instant pulse, pinned under the club */}
            <div className="side-chips">
              <span className="side-chip green" title="Today earnings (payment ledger)">
                Today <b className="money">{formatCurrency(stats?.todayEarnings ?? 0)}</b>
              </span>
              <span className="side-chip red" title="Total member due">
                Due <b className="money">{formatCurrency(stats?.totalDue ?? 0)}</b>
              </span>
            </div>
          </div>
        )}

        <nav className="nav">
          {NAV.filter((n) => !(n.adminOnly && user?.role === 'staff')).map((n) => {
            if (n.to && !n.children) {
              const Icon = n.icon
              return (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={() => setDrawer(false)}>
                  <Icon size={14} />
                  <span>{n.label}</span>
                </NavLink>
              )
            }
            const kids = n.children ?? []
            const groupActive = kids.some((c) => location.pathname.startsWith(c.to))
            const GroupIcon = n.icon
            return (
              <div key={n.label} className={`nav-group${adminOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className={`nav-item nav-group-label${groupActive ? ' group-active' : ''}`}
                  onClick={() => setAdminOpen((o) => !o)}
                  aria-expanded={adminOpen}
                >
                  <GroupIcon size={14} />
                  <span>{n.label}</span>
                  <ChevronDown size={13} className="nav-chevron" />
                </button>
                <div className="nav-children">
                  {kids.map((c) => {
                    const Icon = c.icon
                    return (
                      <NavLink key={c.to} to={c.to} className={({ isActive }) => `nav-item nav-sub${isActive ? ' active' : ''}`} onClick={() => setDrawer(false)}>
                        <Icon size={12} />
                        <span>{c.label}</span>
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {user?.role === 'master' && (
            <NavLink to="/master" className={({ isActive }) => `nav-item nav-master${isActive ? ' active' : ''}`} onClick={() => setDrawer(false)}>
              <Shield size={14} />
              <span>Master Admin</span>
            </NavLink>
          )}
        </nav>

        <div className="side-stats-spacer" />

        <div className="side-tools">
          <button className="tool-btn" onClick={toggle} aria-label="Toggle theme" title="Toggle dark / light theme">
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button className="tool-btn" onClick={doRefresh} aria-label="Refresh data" title="Refresh data">
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            className="tool-btn"
            onClick={() => setTour(true)}
            aria-label="Replay the app walkthrough"
            title="App walkthrough — new here? Take the tour"
          >
            <Compass size={13} />
            <span>Tour</span>
          </button>
        </div>

        <div className="side-user">
          <Avatar name={user?.name ?? ''} picture={user?.picture} />
          <div className="side-user-text">
            <div className="side-user-name">{user?.name}</div>
            <div className="side-user-role">{user?.role === 'master' ? 'Master Admin' : user?.role}</div>
          </div>
          <button className="btn-icon" aria-label="Sign out" title="Sign out" onClick={logout}>
            <LogOut size={13} />
          </button>
        </div>

        <div className="side-credit">
          <span className="side-credit-badge">v{APP_VERSION}</span>
          <span className="side-credit-text">Powered by <b>Rowdy's Den</b></span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn-icon menu-btn" aria-label="Open menu" onClick={() => setDrawer(true)}>
            <Menu size={16} />
          </button>
          <span className="topbar-date">{todayLabel()}</span>
          <span className="spacer" />
          <button
            className="btn-icon"
            aria-label="Quick search (Ctrl K)"
            title="Quick search — member, table, item, page (Ctrl K)"
            data-tour="t-search"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={15} />
          </button>
          {club && <AlertsBell />}
          {user?.role === 'master' ? (
            <span className="badge badge-gold">Master Admin</span>
          ) : sub ? (
            <span className={`badge ${sub.status === 'active' || sub.status === 'trial' ? 'badge-green' : 'badge-red'}`}>
              {sub.planName} · {sub.status}
            </span>
          ) : null}
          <span className="topbar-avatar">
            <Avatar name={user?.name ?? ''} picture={user?.picture} />
          </span>
        </header>

        {error && (
          <div className="banner banner-error">
            <span>{error}</span>
            <Btn size="sm" variant="ghost" onClick={() => void refresh(false)}>
              Retry
            </Btn>
          </div>
        )}

        <main className="page" ref={mainRef}>
          {!club && !refreshing ? (
            <div className="empty" style={{ marginTop: 60 }}>
              <div className="empty-title">No club selected</div>
              <div className="empty-hint">
                {user?.role === 'owner' ? 'Create your first club to start billing.' : 'Ask the owner for club access, or pick a club above.'}
              </div>
              {user?.role === 'owner' && (
                <Btn variant="green" className="mt" onClick={() => setClubModal(true)}>
                  <Plus size={13} /> Create Club
                </Btn>
              )}
            </div>
          ) : refreshing && !error ? (
            <div className="full-loader" style={{ marginTop: 60 }}>
              <EightBallLoader size={52} />
            </div>
          ) : (
            <>
              <h1 className="page-title">{title}</h1>
              <div className="page-title-row">
                <p className="page-subtitle">{subtitle}</p>
                <button className="btn-icon title-refresh" aria-label="Refresh page data" title="Refresh data" onClick={doRefresh}>
                  <RefreshCw size={13} className={(isMasterRoute ? maRefreshing : refreshing) ? 'spin' : ''} />
                </button>
              </div>
              <Outlet />
            </>
          )}
        </main>
      </div>

      <SupportChat />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <Walkthrough active={tour} onClose={() => setTour(false)} />

      <Modal
        open={clubModal}
        onClose={() => setClubModal(false)}
        title="Add Club / Branch"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setClubModal(false)}>
              Cancel
            </Btn>
            <Btn variant="green" loading={savingClub} onClick={doAddClub}>
              <Plus size={13} /> Create Club
            </Btn>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Club name</span>
            <TextInput
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              placeholder="Rowdy's Den — Mansarovar"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && doAddClub()}
            />
          </label>
          <p className="muted small">
            Your plan allows {user?.role === 'master' ? 'unlimited' : clubLimit} club(s); you have {clubs.length}.
          </p>
          {user?.role === 'owner' && clubs.length >= clubLimit && (
            <p className="small warn-text">Club limit reached — ask Master Admin to upgrade your plan.</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
