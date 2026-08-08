import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Headset, KeyRound, Mail, Pencil, Plus, Power, Search, Shield, Trash2, Users } from 'lucide-react'
import { api, asArray } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDateTime, parseNum, titleCase } from '../lib/format'
import {
  Badge,
  Btn,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  Modal,
  Select,
  StatCard,
  TextArea,
  TextInput,
} from './ui'
import type {
  AppUser,
  BillingCycle,
  Club,
  Mailout,
  Role,
  SaaSPlan,
  SubStatus,
} from '../types'

interface Overview {
  stats: {
    totalUsers: number
    activeUsers: number
    totalClubs: number
    activeSubscriptions: number
    monthlyRecurringRevenue: number
  }
  users: AppUser[]
  clubs: Club[]
}

// ----------------------------------------------------------- plan modal

function SellerPlanModal({ open, onClose, plan, onSaved }: {
  open: boolean
  onClose: () => void
  plan: SaaSPlan | null
  onSaved: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    price: String(plan?.price ?? ''),
    billingCycle: (plan?.billingCycle ?? 'monthly') as BillingCycle,
    durationDays: String(plan?.durationDays ?? 30),
    trialDays: String(plan?.trialDays ?? 0),
    maxClubs: String(plan?.maxClubs ?? 1),
    features: (plan?.features ?? []).join(', '),
    active: plan?.active ?? true,
    recommended: plan?.recommended ?? false,
    sortOrder: String(plan?.sortOrder ?? 0),
  })

  const save = async () => {
    if (!form.name.trim()) return
    setBusy(true)
    const body = {
      name: form.name.trim(),
      description: form.description || null,
      price: parseNum(form.price),
      billingCycle: form.billingCycle,
      durationDays: Math.trunc(parseNum(form.durationDays, 30)) || 30,
      trialDays: Math.trunc(parseNum(form.trialDays)),
      maxClubs: Math.max(1, Math.trunc(parseNum(form.maxClubs, 1))),
      features: form.features.split(',').map((f) => f.trim()).filter(Boolean),
      active: form.active,
      recommended: form.recommended,
      sortOrder: Math.trunc(parseNum(form.sortOrder)),
    }
    try {
      if (plan) {
        await api(`/master/subscription-plans/${plan.id}`, { method: 'PATCH', body })
        toast.success('Seller plan updated')
      } else {
        await api('/master/subscription-plans', { method: 'POST', body })
        toast.success('Seller plan added')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save plan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? `Edit Plan · ${plan.name}` : 'Add Seller Plan'}
      width={520}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={!form.name.trim()} onClick={save}>
            {plan ? 'Save Plan' : 'Add Plan'}
          </Btn>
        </>
      }
    >
      <div className="form-grid two">
        <Field label="Name"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
        <Field label="Price (₹)"><TextInput inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
        <Field label="Billing cycle">
          <Select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value as BillingCycle })}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </Field>
        <Field label="Duration (days)"><TextInput inputMode="numeric" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} /></Field>
        <Field label="Free trial days"><TextInput inputMode="numeric" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} /></Field>
        <Field label="Max clubs"><TextInput inputMode="numeric" value={form.maxClubs} onChange={(e) => setForm({ ...form, maxClubs: e.target.value })} /></Field>
        <Field label="Sort order"><TextInput inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></Field>
        <Field label="Description"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      </div>
      <Field label="Features (comma separated)">
        <TextArea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="Tables billing, Members & wallets, Reports" />
      </Field>
      <div className="row" style={{ gap: 16 }}>
        <label className="check-row"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><span>Active (selectable at signup)</span></label>
        <label className="check-row"><input type="checkbox" checked={form.recommended} onChange={(e) => setForm({ ...form, recommended: e.target.checked })} /><span>Recommended</span></label>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------- subscription modal

function SubscriptionModal({ user, plans, onClose, onSaved }: {
  user: AppUser
  plans: SaaSPlan[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const sub = user.subscription
  const [planId, setPlanId] = useState(sub?.planId ?? '')
  const [status, setStatus] = useState<SubStatus | ''>(sub?.status ?? '')
  const [expiresAt, setExpiresAt] = useState(sub?.expiresAt ? sub.expiresAt.slice(0, 16) : '')
  const [notes, setNotes] = useState(sub?.notes ?? '')
  const [busy, setBusy] = useState<'save' | 'del' | null>(null)

  const save = async () => {
    setBusy('save')
    const body: Record<string, unknown> = {}
    if (planId) body.planId = planId
    if (status) body.status = status
    body.expiresAt = expiresAt ? new Date(expiresAt).toISOString() : null
    body.notes = notes || null
    try {
      await api(`/master/users/${user.id}/subscription`, { method: 'PATCH', body })
      toast.success(`Subscription updated · ${user.name}`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update subscription')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('del')
    try {
      await api(`/master/users/${user.id}/subscription`, { method: 'DELETE' })
      toast.success(`Subscription deleted · ${user.name}`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete subscription')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Subscription · ${user.name}`}
      width={440}
      footer={
        <>
          {sub && (
            <Btn variant="red" loading={busy === 'del'} onClick={remove}>Delete Subscription</Btn>
          )}
          <span className="spacer" />
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy === 'save'} onClick={save}>Save</Btn>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Seller plan">
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Keep current / none</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatCurrency(p.price)}/{p.billingCycle === 'yearly' ? 'yr' : 'mo'} · {p.maxClubs} club{p.maxClubs > 1 ? 's' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as SubStatus | '')}>
            <option value="">Keep current</option>
            {(['pending', 'trial', 'active', 'past_due', 'paused', 'expired', 'cancelled'] as SubStatus[]).map((s) => (
              <option key={s} value={s}>{titleCase(s)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Expiry (blank = auto from duration when activating)">
          <TextInput type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </Field>
        <Field label="Internal notes">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. paid via UPI on 1st…" />
        </Field>
      </div>
      <p className="muted small">
        Setting status to <b>active</b>/<b>trial</b> with no expiry auto-computes one from the plan
        duration. Billing APIs lock with HTTP 402 for every other state.
      </p>
    </Modal>
  )
}

// ----------------------------------------------------------- user modal

function UserModal({ user, clubs, plans, onClose, onSaved }: {
  user: AppUser
  clubs: Club[]
  plans: SaaSPlan[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [role, setRole] = useState<Role>(user.role)
  const [active, setActive] = useState(user.active)
  const [clubIds, setClubIds] = useState<string[]>(user.clubIds)
  const [subModal, setSubModal] = useState(false)
  const [busy, setBusy] = useState(false)

  const toggleClub = (id: string) =>
    setClubIds((list) => (list.includes(id) ? list.filter((c) => c !== id) : [...list, id]))

  const save = async () => {
    setBusy(true)
    try {
      await api(`/master/users/${user.id}`, { method: 'PATCH', body: { role, active, clubIds } })
      toast.success(`Account updated · ${user.name}`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`Manage · ${user.name}`}
        width={440}
        footer={
          <>
            <Btn variant="blue" onClick={() => setSubModal(true)}>
              <KeyRound size={12} /> Subscription
            </Btn>
            <span className="spacer" />
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="green" loading={busy} onClick={save}>Save Account</Btn>
          </>
        }
      >
        <div className="muted small" style={{ marginBottom: 8 }}>
          {user.email} · ID <code>{user.id}</code>
        </div>
        <div className="bill-rows" style={{ marginBottom: 8 }}>
          <div className="bill-row"><span>Phone</span><b>{user.phone || '—'}</b></div>
          <div className="bill-row"><span>Location</span><b>{user.location || '—'}</b></div>
          {!user.phone && !user.location && (
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              Not shared yet — the user can fill these from Settings → My Profile.
            </p>
          )}
        </div>
        <div className="form-grid two">
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="owner">Owner</option>
              <option value="staff">Staff</option>
              <option value="master">Master</option>
            </Select>
          </Field>
          <Field label="Access">
            <Select value={active ? 'active' : 'disabled'} onChange={(e) => setActive(e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </Select>
          </Field>
        </div>
        <Field label={`Club access (${clubIds.length} assigned)`}>
          <div className="club-checks">
            {clubs.map((c) => (
              <label key={c.id} className="check-row">
                <input type="checkbox" checked={clubIds.includes(c.id)} onChange={() => toggleClub(c.id)} />
                <span>{c.name} <code className="muted small">{c.id}</code></span>
              </label>
            ))}
            {clubs.length === 0 && <span className="muted small">No clubs exist yet.</span>}
          </div>
        </Field>
        <div className="bill-rows">
          <div className="bill-row"><span>Plan</span><b>{user.subscription?.planName ?? '—'}</b></div>
          <div className="bill-row">
            <span>Status</span>
            <b>{user.subscription ? `${user.subscription.status} · ${user.subscription.maxClubs} club max` : 'no subscription'}</b>
          </div>
        </div>
      </Modal>
      {subModal && (
        <SubscriptionModal user={user} plans={plans} onClose={() => setSubModal(false)} onSaved={onSaved} />
      )}
    </>
  )
}

// ================================================================= screen

export default function MasterAdminScreen() {
  const { user } = useAuth()
  const toast = useToast()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [plans, setPlans] = useState<SaaSPlan[]>([])
  const [search, setSearch] = useState('')
  const [, setLoading] = useState(false)
  const [userModal, setUserModal] = useState<AppUser | null>(null)
  const [planModal, setPlanModal] = useState<{ plan: SaaSPlan | null } | null>(null)
  const [delPlan, setDelPlan] = useState<SaaSPlan | null>(null)
  const [delBusy, setDelBusy] = useState(false)

  const [mails, setMails] = useState<Mailout[]>([])
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactBusy, setContactBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, sp, mo, ct] = await Promise.all([
        api('/master/overview'),
        api('/subscription-plans'),
        api('/master/mailouts'),
        api('/platform/support'),
      ])
      setOverview(ov as Overview)
      setPlans(asArray<SaaSPlan>(sp))
      setMails(asArray<Mailout>(mo))
      setContactEmail(ct?.email ?? '')
      setContactPhone(ct?.phone ?? '')
      // also include inactive seller plans for management: fetch via known ids is
      // unnecessary — overview does not list plans, so keep the active list for
      // assignment and manage active state from what we have.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load master data')
    } finally {
      setLoading(false)
      window.dispatchEvent(new Event('rd:refresh-done'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Title-row refresh button drops this event (Layout) — reload own data.
  useEffect(() => {
    const onRefresh = () => void load()
    window.addEventListener('rd:refresh', onRefresh)
    return () => window.removeEventListener('rd:refresh', onRefresh)
  }, [load])

  const saveContact = async () => {
    setContactBusy(true)
    try {
      const saved = await api('/platform/support', {
        method: 'PATCH',
        body: { email: contactEmail.trim(), phone: contactPhone.trim() },
      })
      setContactEmail(saved?.email ?? '')
      setContactPhone(saved?.phone ?? '')
      toast.success('Support contact updated — Rowdy Care & the sidebar Human Support tab now use it')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save contact')
    } finally {
      setContactBusy(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const users = overview?.users ?? []
    if (!q) return users
    const clubById = new Map((overview?.clubs ?? []).map((c) => [c.id, c.name.toLowerCase()]))
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.includes(q) ||
        (u.clubIds ?? []).some((cid) => cid.includes(q) || (clubById.get(cid) || '').includes(q)),
    )
  }, [overview, search])

  if (user?.role !== 'master') return <Navigate to="/tables" replace />

  const stats = overview?.stats

  const togglePlan = async (p: SaaSPlan) => {
    try {
      await api(`/master/subscription-plans/${p.id}/toggle-active`, { method: 'POST' })
      toast.success(`Plan ${p.active ? 'deactivated' : 'activated'} · ${p.name}`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not toggle plan')
    }
  }

  const doDeletePlan = async () => {
    if (!delPlan) return
    setDelBusy(true)
    try {
      await api(`/master/subscription-plans/${delPlan.id}`, { method: 'DELETE' })
      toast.success(`Seller plan deleted · ${delPlan.name}`)
      setDelPlan(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete plan')
    } finally {
      setDelBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="muted small">SaaS accounts, subscriptions, seller plans &amp; all club IDs</p>
        </div>
        <div className="row">
          <div className="search-box">
            <Search size={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, user/club ID" aria-label="Search accounts" />
          </div>
        </div>
      </div>

      <div className="grid-stats five">
        <StatCard label="Accounts" tone="blue" value={`${stats?.activeUsers ?? 0}/${stats?.totalUsers ?? 0}`} sub="active / total" />
        <StatCard label="Total Clubs" tone="green" value={stats?.totalClubs ?? 0} sub="branches" />
        <StatCard label="Active Subscriptions" tone="gold" value={stats?.activeSubscriptions ?? 0} sub="trial + active" />
        <StatCard label="Platform MRR" tone="green" value={formatCurrency(stats?.monthlyRecurringRevenue ?? 0)} sub="monthly recurring" />
        <StatCard label="Seller Plans" tone="blue" value={plans.length} sub="active catalog" />
      </div>

      {/* ------------------------------------------------ login accounts */}
      <Card>
        <div className="section-head">
          <div className="section-title">
            <Users size={13} /> Login Accounts &amp; Subscriptions
          </div>
        </div>
        {filteredUsers.length === 0 ? (
          <EmptyState title="No accounts found" />
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Access</th>
                  <th>Clubs</th>
                  <th>Subscription</th>
                  <th>Last Login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="account-cell">
                        {u.picture ? (
                          <img className="avatar" src={u.picture} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="avatar avatar-initial">{(u.name || '?')[0].toUpperCase()}</span>
                        )}
                        <div>
                          <div>{u.name}</div>
                          <div className="muted small">
                            {u.email} · <code>{u.id}</code>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><Badge kind={u.role === 'master' ? 'gold' : 'muted'}>{titleCase(u.role)}</Badge></td>
                    <td><Badge kind={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Disabled'}</Badge></td>
                    <td>{u.clubIds?.length ?? 0}{u.subscription ? ` / ${u.subscription.maxClubs}` : ''}</td>
                    <td>
                      {u.subscription ? (
                        <Badge kind={u.subscription.status === 'active' || u.subscription.status === 'trial' ? 'green' : 'red'}>
                          {u.subscription.planName} · {u.subscription.status}
                        </Badge>
                      ) : (
                        <span className="muted small">none</span>
                      )}
                    </td>
                    <td className="nowrap muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
                    <td>
                      <Btn size="sm" variant="blue" onClick={() => setUserModal(u)}>Manage</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* --------------------------------------------------- seller plans */}
      <Card>
        <div className="section-head">
          <div className="section-title">
            <Shield size={13} /> Seller Subscription Plans
          </div>
          <Btn size="sm" variant="green" onClick={() => setPlanModal({ plan: null })}>
            <Plus size={12} /> Add Plan
          </Btn>
        </div>
        <div className="menu-list">
          {plans.map((p) => (
            <div key={p.id} className={`menu-row${p.active ? '' : ' inactive'}`}>
              <span className="menu-name">
                {p.name}
                {p.recommended && <Badge kind="gold">recommended</Badge>}
                {p.trialDays > 0 && <Badge kind="green">{p.trialDays}d trial</Badge>}
                {!p.active && <Badge kind="muted">inactive</Badge>}
              </span>
              <span className="muted small nowrap">
                {formatCurrency(p.price)}/{p.billingCycle === 'yearly' ? 'yr' : 'mo'} · {p.durationDays}d · max {p.maxClubs} club{p.maxClubs > 1 ? 's' : ''}
              </span>
              <button className="btn-icon" aria-label={`${p.active ? 'Deactivate' : 'Activate'} ${p.name}`} title={p.active ? 'Deactivate' : 'Activate'} onClick={() => togglePlan(p)}>
                <Power size={12} className={p.active ? 'ok' : 'off'} />
              </button>
              <button className="btn-icon" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => setPlanModal({ plan: p })}>
                <Pencil size={12} />
              </button>
              <button className="btn-icon danger" aria-label={`Delete ${p.name}`} title="Delete" onClick={() => setDelPlan(p)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {plans.length === 0 && <p className="muted small">No plans yet — create plans owners pick at signup.</p>}
        </div>
      </Card>

      {/* ----------------------------------------------------- all clubs */}
      <Card>
        <div className="section-title">All Clubs / Branch IDs</div>
        <div className="ma-clubs">
          <div className="menu-list">
            {(overview?.clubs ?? []).map((c) => (
              <div key={c.id} className="menu-row">
                <span className="club-dot">
                  {c.logo ? <img src={c.logo} alt="" className="avatar" /> : <span className="avatar avatar-initial">{c.name[0]}</span>}
                </span>
                <span className="menu-name">{c.name}</span>
                <code className="muted small">{c.id}</code>
                <span className="muted small nowrap">owner: <code>{c.ownerUserId || 'unassigned'}</code></span>
                <span className="muted small nowrap">{formatDateTime(c.createdAt)}</span>
              </div>
            ))}
            {(overview?.clubs ?? []).length === 0 && <p className="muted small">No clubs created yet.</p>}
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------- support contact */}
      <Card>
        <div className="section-head">
          <div className="section-title">
            <Headset size={13} /> Human Support Contact
          </div>
          <Btn size="sm" variant="green" loading={contactBusy} onClick={saveContact}>Save Contact</Btn>
        </div>
        <p className="muted small" style={{ margin: '2px 0 8px' }}>
          Rowdy Care's "Human se baat" reply and the sidebar's Human Support tab both show this email/number — direct help for owners and staff.
        </p>
        <div className="form-grid two">
          <Field label="Support email"><TextInput inputMode="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@gmail.com" /></Field>
          <Field label="Support phone / WhatsApp"><TextInput inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91 98XXXXXXXX" /></Field>
        </div>
      </Card>

      {/* ----------------------------------------------------- email log */}
      <Card>
        <div className="section-title">
          <Mail size={13} /> Emails Sent / Recorded
        </div>
        <p className="muted small" style={{ margin: '2px 0 8px' }}>
          Every mail the system produced — subscription welcomes, member plan sales, balance notifies, expiry
          warnings. <b>sent</b> = actually delivered via SMTP; <b>recorded</b> = SMTP not configured yet (dev).
        </p>
        {mails.length === 0 ? (
          <EmptyState title="No emails yet" hint="Mails appear the moment subscriptions or member plans are sold." />
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>Kind</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mails.slice(0, 50).map((m) => (
                  <tr key={m.id}>
                    <td className="nowrap muted">{formatDateTime(m.createdAt)}</td>
                    <td className="nowrap">{m.to ?? '—'}</td>
                    <td><Badge kind={m.kind === 'plan_expired' ? 'red' : m.kind === 'subscription' ? 'gold' : 'blue'}>{m.kind.replace(/_/g, ' ')}</Badge></td>
                    <td className="desc">{m.subject}</td>
                    <td className="nowrap">
                      {m.sent ? (
                        <Badge kind="green">sent</Badge>
                      ) : (
                        <span className="badge badge-muted" title={m.error ?? undefined}>recorded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {userModal && (
        <UserModal user={userModal} clubs={overview?.clubs ?? []} plans={plans} onClose={() => setUserModal(null)} onSaved={load} />
      )}
      {planModal && (
        <SellerPlanModal open onClose={() => setPlanModal(null)} plan={planModal.plan} onSaved={load} />
      )}
      <ConfirmModal
        open={!!delPlan}
        onClose={() => setDelPlan(null)}
        onConfirm={doDeletePlan}
        busy={delBusy}
        title="Delete seller plan"
        message={delPlan ? `Delete ${delPlan.name}? Accounts already on this plan keep their recorded subscription.` : ''}
      />
    </div>
  )
}
