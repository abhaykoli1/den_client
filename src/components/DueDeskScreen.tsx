import { useMemo, useState } from 'react'
import { MessageCircle, Search, Wallet } from 'lucide-react'
import { useClub } from '../context/ClubContext'
import { useToast } from '../context/ToastContext'
import { formatCurrency, titleCase } from '../lib/format'
import { Badge, Btn, Card, EmptyState, Seg, StatCard, TextInput } from './ui'
import { parseNum } from '../lib/format'
import InsightsCard from './InsightsCard'
import { useSearchSeed } from '../lib/useSearchSeed'
import type { Member, PlanPaymentMode } from '../types'

/** wa.me deep link with a polite prefilled due reminder. */
function waRemindUrl(m: Member, clubName: string): string {
  const digits = (m.phone || '').replace(/\D/g, '')
  const withCc = digits.length === 10 ? `91${digits}` : digits
  const text =
    `Hello ${m.name}, a friendly reminder from ${clubName} — ` +
    `your due of ${formatCurrency(m.dueAmount)} is still pending. ` +
    `Please clear it at the counter whenever convenient. Thank you! 🎱`
  return `https://wa.me/${withCc}?text=${encodeURIComponent(text)}`
}

function DueRow({ member, clubName }: { member: Member; clubName: string }) {
  const { mutate } = useClub()
  const toast = useToast()
  const [amount, setAmount] = useState(() => String(member.dueAmount))
  const [mode, setMode] = useState<PlanPaymentMode>('cash')
  const [busy, setBusy] = useState(false)

  const collect = async () => {
    const amt = parseNum(amount)
    if (amt <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    if (amt > member.dueAmount) {
      toast.error(`Overpayment not allowed — due is ${formatCurrency(member.dueAmount)}`)
      return
    }
    setBusy(true)
    const r = await mutate(`members/${member.id}/payments`, {
      body: { amount: amt, mode },
      toast: `Payment recorded · ${member.name} · ${formatCurrency(amt)} ${mode.toUpperCase()}`,
    })
    setBusy(false)
    if (r) setAmount('')
  }

  return (
    <Card className="due-row">
      <div className="due-info">
        <div className="pc-namerow">
          <span className="pc-name">{member.name}</span>
          <Badge kind="red">Due {formatCurrency(member.dueAmount)}</Badge>
          {member.planName && <Badge kind="gold">{member.planName}</Badge>}
          <Badge kind="muted">{titleCase(member.type)}</Badge>
        </div>
        <div className="muted small">
          {member.phone || 'No phone'}
          {member.walletBalance > 0 ? ` · wallet ${formatCurrency(member.walletBalance)}` : ''}
        </div>
      </div>
      <div className="due-actions">
        <TextInput
          inputMode="decimal"
          value={amount}
          placeholder="Amount"
          aria-label="Payment amount"
          onChange={(e) => setAmount(e.target.value)}
          style={{ maxWidth: 110 }}
        />
        <Seg
          value={mode}
          onChange={(v) => setMode(v as PlanPaymentMode)}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'upi', label: 'UPI' },
            { value: 'card', label: 'Card' },
          ]}
        />
        <Btn variant="green" size="sm" loading={busy} onClick={collect}>
          Collect
        </Btn>
        {member.phone ? (
          <a
            className="btn btn-ghost btn-sm due-remind"
            href={waRemindUrl(member, clubName)}
            target="_blank"
            rel="noreferrer"
            title={`WhatsApp reminder to ${member.name}`}
          >
            <MessageCircle size={12} /> Remind
          </a>
        ) : (
          <Btn variant="ghost" size="sm" disabled className="due-remind" title="No phone number saved — edit the member to add one">
            <MessageCircle size={12} /> Remind
          </Btn>
        )}
      </div>
    </Card>
  )
}

export default function DueDeskScreen() {
  const { data } = useClub()
  const [search, setSearch] = useState('')
  useSearchSeed(setSearch)
  const members = data?.members ?? []
  const dueMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members
      .filter((m) => m.active && m.dueAmount > 0)
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.phone || '').includes(q))
      .sort((a, b) => b.dueAmount - a.dueAmount)
  }, [members, search])

  const total = members.filter((m) => m.active).reduce((s, m) => s + (m.dueAmount || 0), 0)

  return (
    <div className="stack">
      <div className="page-head">
        <div className="search-box">
          <Search size={13} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone" aria-label="Search due members" />
        </div>
      </div>

      <div className="grid-stats">
        <StatCard label="Pending Due" tone="red" value={formatCurrency(total)} sub={`${members.filter((m) => m.active && m.dueAmount > 0).length} members`} />
        <StatCard label="Wallet Held" tone="gold" value={formatCurrency(members.reduce((s, m) => s + (m.walletBalance || 0), 0))} sub="Prepaid balances" />
        <StatCard label="Due Limit" tone="blue" value={formatCurrency(data?.club.settings.dueLimit ?? 0)} sub="Club setting" />
      </div>

      <InsightsCard compact scopes={['members']} max={3} />

      {dueMembers.length === 0 ? (
        <EmptyState icon={<Wallet size={28} />} title="No pending dues" hint="Members with due balances appear here automatically." />
      ) : (
        <div className="stack-sm">
          {dueMembers.map((m) => (
            <DueRow key={m.id} member={m} clubName={data?.club.name ?? 'Club'} />
          ))}
        </div>
      )}
    </div>
  )
}
