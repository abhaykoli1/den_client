import { useEffect, useMemo, useState } from 'react'
import { Mail, Pencil, Plus, ScrollText, Search, Trash2 } from 'lucide-react'
import { api, asArray } from '../lib/api'
import { useClub } from '../context/ClubContext'
import { useToast } from '../context/ToastContext'
import {
  formatCurrency,
  formatDateTime,
  modeBadge,
  parseNum,
  planValid,
  titleCase,
} from '../lib/format'
import {
  Badge,
  Btn,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  Modal,
  Seg,
  Select,
  StatCard,
  TextArea,
  TextInput,
} from './ui'
import InsightsCard from './InsightsCard'
import { useSearchSeed } from '../lib/useSearchSeed'
import type { ActivityLog, Member, MembershipPlan, PlanPaymentMode } from '../types'

// ---------------------------------------------------------- member modal

function derivedCategory(m: {
  planType?: string | null
  dueAmount: number
  walletBalance: number
  passFramesLeft: number
  planExpiresAt?: string | null
}): string {
  if (m.dueAmount > 0) return 'due'
  if (m.planType === 'monthly' && planValid(m.planExpiresAt)) return 'monthly'
  if ((m.passFramesLeft ?? 0) > 0) return 'pass'
  if (m.walletBalance > 0) return 'wallet'
  if (m.planType) return m.planType
  return 'regular'
}

interface MemberForm {
  name: string
  phone: string
  email: string
  planId: string
  walletBalance: string
  dueAmount: string
  passFramesLeft: string
  notes: string
  active: boolean
  planPaymentMode: PlanPaymentMode
}

function MemberModal({ open, onClose, member, plans }: {
  open: boolean
  onClose: () => void
  member: Member | null
  plans: MembershipPlan[]
}) {
  const { mutate } = useClub()
  const [form, setForm] = useState<MemberForm | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      name: member?.name ?? '',
      phone: member?.phone ?? '',
      email: member?.email ?? '',
      planId: member?.planId ?? '',
      walletBalance: String(member?.walletBalance ?? 0),
      dueAmount: String(member?.dueAmount ?? 0),
      passFramesLeft: String(member?.passFramesLeft ?? 0),
      notes: member?.notes ?? '',
      active: member?.active ?? true,
      planPaymentMode: 'cash',
    })
  }, [open, member])

  if (!form) return null
  const plan = plans.find((p) => p.id === form.planId) ?? null
  const alreadyAssigned = Boolean(member && member.planId && member.planId === form.planId)
  const category = plan
    ? plan.type
    : derivedCategory({
        planType: member?.planType,
        dueAmount: parseNum(form.dueAmount),
        walletBalance: parseNum(form.walletBalance),
        passFramesLeft: parseNum(form.passFramesLeft),
        planExpiresAt: member?.planExpiresAt,
      })

  const benefit = plan
    ? plan.type === 'wallet'
      ? `Member receives ${formatCurrency(plan.value)} wallet credit`
      : plan.type === 'pass'
        ? `Member receives ${Math.trunc(plan.value)} frame passes`
        : `Member receives ${plan.tableDiscountPercent}% premium table discount`
    : null

  const save = async () => {
    if (!form.name.trim()) return
    setBusy(true)
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      walletBalance: parseNum(form.walletBalance),
      dueAmount: parseNum(form.dueAmount),
      passFramesLeft: Math.trunc(parseNum(form.passFramesLeft)),
      notes: form.notes || null,
      active: form.active,
    }
    if (!alreadyAssigned) {
      body.planId = form.planId || null
      if (plan) body.planPaymentMode = form.planPaymentMode
    }
    const r = member
      ? await mutate(`members/${member.id}`, { method: 'PATCH', body, toast: alreadyAssigned || !plan ? 'Member updated' : `Member updated · plan sold ${formatCurrency(plan.amount)}` })
      : await mutate('members', { body, toast: plan ? `Member added · plan sold ${formatCurrency(plan.amount)}` : 'Member added' })
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? `Edit · ${member.name}` : 'Add Player'}
      width={520}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={!form.name.trim()} onClick={save}>
            {member ? 'Save Member' : 'Add Player'}
          </Btn>
        </>
      }
    >
      <div className="form-grid two">
        <Field label="Name"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
        <Field label="Phone"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98xxxxxx90" /></Field>
        <Field label="Email"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Category">
          <div className="input-like">
            <Badge kind="gold">{titleCase(category)}</Badge>
            <span className="muted small">auto-selected by plan/balances</span>
          </div>
        </Field>
        <Field label="Membership Plan">
          <Select value={form.planId} disabled={alreadyAssigned} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
            <option value="">No plan</option>
            {plans.filter((p) => p.active || p.id === form.planId).map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {titleCase(p.type)} · {formatCurrency(p.amount)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Notes"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>

      {plan && (
        <div className="plan-preview">
          {alreadyAssigned ? (
            <Badge kind="blue">Already assigned — plan will not be charged again</Badge>
          ) : (
            <>
              <div className="bill-row"><span>Plan amount to collect</span><b className="money-gold">{formatCurrency(plan.amount)}</b></div>
              <div className="bill-row"><span>Benefit</span><b>{benefit}</b></div>
              {plan.days > 0 && <div className="bill-row"><span>Validity</span><b>{plan.days} days</b></div>}
              <div className="row">
                <span className="field-label">Collect via</span>
                <Seg
                  value={form.planPaymentMode}
                  onChange={(v) => setForm({ ...form, planPaymentMode: v as PlanPaymentMode })}
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'upi', label: 'UPI' },
                    { value: 'card', label: 'Card' },
                  ]}
                />
              </div>
            </>
          )}
        </div>
      )}

      <div className="form-grid three">
        <Field label="Wallet Balance"><TextInput inputMode="decimal" value={form.walletBalance} onChange={(e) => setForm({ ...form, walletBalance: e.target.value })} /></Field>
        <Field label="Due Amount"><TextInput inputMode="decimal" value={form.dueAmount} onChange={(e) => setForm({ ...form, dueAmount: e.target.value })} /></Field>
        <Field label="Pass Frames"><TextInput inputMode="numeric" value={form.passFramesLeft} onChange={(e) => setForm({ ...form, passFramesLeft: e.target.value })} /></Field>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        <span>Active member</span>
      </label>
    </Modal>
  )
}

// ---------------------------------------------------------- record modal

function RecordModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const { club } = useClub()
  const [logs, setLogs] = useState<ActivityLog[] | null>(null)

  useEffect(() => {
    if (!club) return
    api(`/clubs/${club.id}/logs?memberId=${member.id}&limit=60`)
      .then((l) => setLogs(asArray<ActivityLog>(l)))
      .catch(() => setLogs([]))
  }, [club?.id, member.id])

  return (
    <Modal open onClose={onClose} title={`Record · ${member.name}`} width={560}>
      <div className="row wrap" style={{ gap: 6 }}>
        <Badge kind="muted">{member.phone || 'No phone'}</Badge>
        {member.planName && <Badge kind="gold">{member.planName}</Badge>}
        {member.notes && <span className="muted small">{member.notes}</span>}
      </div>
      <div className="grid-stats three" style={{ margin: '10px 0' }}>
        <StatCard label="Due" tone="red" value={formatCurrency(member.dueAmount)} />
        <StatCard label="Wallet" tone="gold" value={formatCurrency(member.walletBalance)} />
        <StatCard label="Pass Frames" tone="blue" value={member.passFramesLeft} />
      </div>
      {!logs ? (
        <p className="muted small">Loading activity…</p>
      ) : logs.length === 0 ? (
        <EmptyState title="No activity yet" hint="Billing, payments and plan sales show up here." />
      ) : (
        <div className="record-list">
          {logs.map((l) => (
            <div key={l.id} className="record-item">
              <div className="record-meta">
                <Badge kind={l.tag === 'PAYMENT' ? 'green' : l.tag === 'WARNING' ? 'red' : l.tag === 'ADMIN' ? 'gold' : 'blue'}>{l.tag}</Badge>
                {l.mode && <span className="muted small">{modeBadge(l.mode)}</span>}
                <span className="muted small">{formatDateTime(l.createdAt)}</span>
              </div>
              <div className="record-msg">{l.message}</div>
              {l.amount != null && <div className="money-green small">{formatCurrency(l.amount)}</div>}
              {l.note && <div className="muted small">{l.note}</div>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ----------------------------------------------------------- player card

function PlayerCard({ member, onEdit, onDelete, onRecord }: {
  member: Member
  onEdit: () => void
  onDelete: () => void
  onRecord: () => void
}) {
  const { mutate } = useClub()
  const toast = useToast()
  const [name, setName] = useState(member.name)
  const [phone, setPhone] = useState(member.phone)
  const [signedBal, setSignedBal] = useState(() => String(member.walletBalance - member.dueAmount))
  const [payAmt, setPayAmt] = useState('')
  const [busy, setBusy] = useState<null | 'save' | 'bal' | 'cash' | 'upi' | 'notify'>(null)

  useEffect(() => {
    setName(member.name)
    setPhone(member.phone)
    setSignedBal(String(Math.round((member.walletBalance - member.dueAmount) * 100) / 100))
  }, [member.id, member.updatedAt])

  const due = member.dueAmount > 0
  const wallet = member.walletBalance > 0
  const balanceText = due ? `Due ${formatCurrency(member.dueAmount)}` : wallet ? `Wallet ${formatCurrency(member.walletBalance)}` : 'Clear ₹0'
  const balanceClass = due ? 'money-red' : wallet ? 'money-gold' : 'money-green'

  const save = async () => {
    setBusy('save')
    await mutate(`members/${member.id}`, {
      method: 'PATCH',
      body: { name: name.trim() || member.name, phone: phone.trim() },
      toast: 'Member updated',
    })
    setBusy(null)
  }

  // One tap → member gets their wallet/pass/due snapshot on email.
  const notify = async () => {
    if (!member.email) {
      toast.error(`No email on ${member.name}'s profile — edit the member and add one first`)
      return
    }
    setBusy('notify')
    const r = await mutate(`members/${member.id}/notify`, { body: {} })
    setBusy(null)
    if (r) toast.success(`Balance update mailed · ${member.name} · ${member.email}`)
  }

  const setBalance = async () => {
    const v = parseNum(signedBal)
    setBusy('bal')
    await mutate(`members/${member.id}`, {
      method: 'PATCH',
      body: { walletBalance: Math.max(0, v), dueAmount: Math.max(0, -v) },
      toast: `Balance updated · ${v >= 0 ? 'wallet' : 'due'} ${formatCurrency(Math.abs(v))}`,
    })
    setBusy(null)
  }

  const pay = async (mode: 'cash' | 'upi') => {
    const amount = parseNum(payAmt)
    if (amount <= 0) {
      toast.error('Enter a payment amount')
      return
    }
    if (amount > member.dueAmount) {
      toast.error(`Amount exceeds due ${formatCurrency(member.dueAmount)}`)
      return
    }
    setBusy(mode)
    const r = await mutate<{ member: Member }>(`members/${member.id}/payments`, {
      body: { amount, mode },
      toast: `Payment recorded · ${formatCurrency(amount)} ${mode === 'cash' ? 'Cash' : 'Online'}`,
    })
    setBusy(null)
    if (r) setPayAmt('')
  }

  const validity = member.planExpiresAt
    ? planValid(member.planExpiresAt)
      ? `Valid till ${formatDateTime(member.planExpiresAt)}`
      : 'Plan expired'
    : null

  return (
    <Card className={`player-card${member.active ? '' : ' inactive'}`}>
      <div className="pc-main">
        <div className="pc-info">
          <div className="pc-namerow">
            <span className="pc-name">{member.name}</span>
            {!member.active && <Badge kind="muted">Inactive</Badge>}
            {member.planName && <Badge kind="gold">{member.planName}</Badge>}
            {member.tableDiscountPercent > 0 && <Badge kind="blue">Premium {member.tableDiscountPercent}%</Badge>}
            {member.passFramesLeft > 0 && <Badge kind="green">Pass {member.passFramesLeft} left</Badge>}
            {validity && <Badge kind={validity.startsWith('Valid') ? 'muted' : 'red'}>{validity}</Badge>}
          </div>
          <div className="muted small">{member.phone || 'No phone'}</div>
          {member.notes && <div className="muted small pc-notes">{member.notes}</div>}
        </div>
        <div className={`pc-balance ${balanceClass}`}>{balanceText}</div>
      </div>

      <div className="pc-edit">
        <TextInput value={name} aria-label="Member name" onChange={(e) => setName(e.target.value)} />
        <TextInput value={phone} aria-label="Member phone" placeholder="Phone" onChange={(e) => setPhone(e.target.value)} />
        <div className="row">
          <TextInput inputMode="decimal" value={signedBal} aria-label="Signed balance (+wallet / -due)" title="Positive = wallet, negative = due, zero = clear" onChange={(e) => setSignedBal(e.target.value)} />
          <Btn size="sm" variant="blue" loading={busy === 'bal'} onClick={setBalance}>Set Balance</Btn>
        </div>
        <div className="row">
          <Btn size="sm" variant="green" loading={busy === 'save'} onClick={save}>Save</Btn>
          <span className="spacer" />
          <TextInput inputMode="decimal" value={payAmt} placeholder="Pay amount" aria-label="Payment amount" style={{ maxWidth: 110 }} onChange={(e) => setPayAmt(e.target.value)} />
          <Btn size="sm" variant="gold" loading={busy === 'cash'} disabled={member.dueAmount <= 0} onClick={() => pay('cash')}>Cash</Btn>
          <Btn size="sm" variant="blue" loading={busy === 'upi'} disabled={member.dueAmount <= 0} onClick={() => pay('upi')}>Online</Btn>
        </div>
      </div>

      <div className="pc-footer">
        <button aria-label="Record" title="Record" onClick={onRecord}><ScrollText size={13} /><span>Record</span></button>
        <button aria-label="Edit" title="Edit" onClick={onEdit}><Pencil size={13} /><span>Edit</span></button>
        <button
          aria-label="Notify balance"
          title={member.email ? `Email ${member.name} their balance/pass update` : 'Add an email on this member first'}
          disabled={busy === 'notify'}
          onClick={notify}
        >
          <Mail size={13} /><span>{busy === 'notify' ? 'Sending…' : 'Notify'}</span>
        </button>
        <button aria-label="Delete" title="Delete" className="danger" onClick={onDelete}><Trash2 size={13} /><span>Delete</span></button>
      </div>
    </Card>
  )
}

// ================================================================ screen

export default function PlayersScreen() {
  const { data, mutate } = useClub()
  const [search, setSearch] = useState('')
  useSearchSeed(setSearch)
  const [modal, setModal] = useState<{ member: Member | null } | null>(null)
  const [record, setRecord] = useState<Member | null>(null)
  const [confirmDel, setConfirmDel] = useState<Member | null>(null)
  const [delBusy, setDelBusy] = useState(false)

  const members = data?.members ?? []
  const plans = data?.plans ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => m.name.toLowerCase().includes(q) || (m.phone || '').includes(q))
  }, [members, search])

  const wallets = members.reduce((s, m) => s + (m.walletBalance || 0), 0)
  const dues = members.reduce((s, m) => s + (m.dueAmount || 0), 0)

  const doDelete = async () => {
    if (!confirmDel) return
    setDelBusy(true)
    const r = await mutate(`members/${confirmDel.id}`, { method: 'DELETE', toast: `Member deleted · ${confirmDel.name}` })
    setDelBusy(false)
    if (r) setConfirmDel(null)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="muted small">Members, wallets, passes and dues</p>
        </div>
        <div className="row">
          <div className="search-box">
            <Search size={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone" aria-label="Search players" />
          </div>
          <Btn variant="green" onClick={() => setModal({ member: null })}>
            <Plus size={13} /> Add Player
          </Btn>
        </div>
      </div>

      <div className="grid-stats">
        <StatCard label="Players" tone="blue" value={members.length} sub={`${members.filter((m) => m.active).length} active`} />
        <StatCard label="Wallet Money" tone="gold" value={formatCurrency(wallets)} sub="Prepaid credit held" />

        <StatCard label="Total Due" tone="red" value={formatCurrency(dues)} sub={`${members.filter((m) => m.dueAmount > 0).length} members pending`} />
      </div>

      <InsightsCard compact scopes={['members']} max={2} />

      {filtered.length === 0 ? (
        <EmptyState title={search ? 'No players match the search' : 'No players yet'} hint={search ? 'Try another name or phone.' : 'Add your first club member.'} />
      ) : (
        <div className="member-grid">
          {filtered.map((m) => (
            <PlayerCard
              key={m.id}
              member={m}
              onEdit={() => setModal({ member: m })}
              onDelete={() => setConfirmDel(m)}
              onRecord={() => setRecord(m)}
            />
          ))}
        </div>
      )}

      {modal && <MemberModal open onClose={() => setModal(null)} member={modal.member} plans={plans} />}
      {record && <RecordModal member={record} onClose={() => setRecord(null)} />}
      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={doDelete}
        busy={delBusy}
        title="Delete member"
        message={confirmDel ? `Delete ${confirmDel.name}? Their balance records and history stay in logs. This cannot be undone.` : ''}
      />
    </div>
  )
}
