import { useMemo, useState } from 'react'
import { Printer, Repeat, Search } from 'lucide-react'
import { useClub } from '../context/ClubContext'
import InsightsCard from './InsightsCard'
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  modeBadge,
  titleCase,
} from '../lib/format'
import { Badge, Btn, Card, EmptyState, Modal, TextInput } from './ui'
import ReceiptModal, { frameReceipt, type ReceiptData } from './ReceiptModal'
import { useSearchSeed } from '../lib/useSearchSeed'
import type { FrameRecord, Settlement, Team } from '../types'

function settlementLine(s: Settlement): string {
  const bits: string[] = []
  if ((s.walletPart ?? 0) > 0) bits.push(`wallet -${formatCurrency(s.walletPart)}`)
  if ((s.cashPart ?? 0) > 0) bits.push(`cash ${formatCurrency(s.cashPart)}`)
  if ((s.duePart ?? 0) > 0) bits.push(`due +${formatCurrency(s.duePart)}`)
  return `${s.memberName}: ${bits.join(' + ') || 'no charge'}`
}

function WinnerModal({ frame, onClose }: { frame: FrameRecord; onClose: () => void }) {
  const { mutate } = useClub()
  const is2v2 = frame.matchMode === '2v2'
  const [winners, setWinners] = useState<string[]>(frame.winnerPlayerIds ?? [])
  const [team, setTeam] = useState<Team | null>(frame.winningTeam ?? null)
  const [busy, setBusy] = useState(false)

  const valid = is2v2
    ? team !== null && team !== frame.winningTeam
    : winners.length >= 1 && winners.length < frame.players.length &&
      JSON.stringify([...winners].sort()) !== JSON.stringify([...(frame.winnerPlayerIds ?? [])].sort())

  const save = async () => {
    setBusy(true)
    const body = is2v2 ? { winningTeam: team } : { winnerPlayerIds: winners }
    const r = await mutate(`frames/${frame.id}/winners`, {
      method: 'PATCH',
      body,
      toast: 'Winner changed · settlement recalculated',
    })
    setBusy(false)
    if (r) onClose()
  }

  const teamOf = (t: Team) => frame.players.filter((p) => p.team === t)

  return (
    <Modal
      open
      onClose={onClose}
      title={`Change Winner · ${frame.tableName}`}
      width={420}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={!valid} onClick={save}>Apply Correction</Btn>
        </>
      }
    >
      <p className="muted small">
        This reverses the old settlement (wallet refunded, newly-added due removed, pass frames
        restored) and re-bills the frame to the new paying side. Cash already collected is
        re-applied, not refunded.
      </p>
      {is2v2 ? (
        <div className="team-pick" style={{ marginTop: 8 }}>
          {(['A', 'B'] as Team[]).map((t) => (
            <button key={t} type="button" className={`team-btn${team === t ? ' active' : ''}`} onClick={() => setTeam(t)}>
              <span className="team-title">Team {t}</span>
              <span className="team-names">{teamOf(t).map((p) => p.label).join(' · ')}</span>
              <span className={`team-role ${team === t ? 'money-green' : 'money-red'}`}>{team === t ? 'Winner' : 'Pays'}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="winner-pick" style={{ marginTop: 8 }}>
          {frame.players.map((p) => {
            const win = winners.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                className={`win-chip${win ? ' win' : ''}`}
                onClick={() =>
                  setWinners((list) => (list.includes(p.id) ? list.filter((x) => x !== p.id) : [...list, p.id]))
                }
              >
                <span>{p.label}</span>
                <span className={win ? 'money-green' : 'money-red'}>{win ? 'Winner' : 'Pays'}</span>
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export default function FramesScreen() {
  const { data } = useClub()
  const [search, setSearch] = useState('')
  useSearchSeed(setSearch)
  const [month, setMonth] = useState('') // '' = all time
  const [winnerFrame, setWinnerFrame] = useState<FrameRecord | null>(null)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  const frames = data?.frames ?? []
  const monthFiltered = useMemo(
    () => (month ? frames.filter((f) => (f.createdAt ?? '').slice(0, 7) === month) : frames),
    [frames, month],
  )
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return monthFiltered
    return monthFiltered.filter((f) =>
      [f.tableName, f.paymentMode, f.matchMode, ...(f.winners ?? []), ...(f.losers ?? []), ...(f.players ?? []).map((p) => p.label)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [monthFiltered, search])

  const totals = useMemo(() => {
    const t = { count: filtered.length, total: 0, collected: 0, due: 0 }
    for (const f of filtered) {
      t.total += f.totalAmount || 0
      t.collected += f.paidAmount || 0
      t.due += f.dueAmount || 0
    }
    return t
  }, [filtered])

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="muted small">Table billing history · winner corrections re-bill automatically</p>
        </div>
        <div className="row">
          <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Filter by month" title="Filter by month" />
          {month && (
            <Btn size="sm" variant="ghost" onClick={() => setMonth('')}>All time</Btn>
          )}
        </div>
        <div className="search-box">
          <Search size={13} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Table, player, mode, winner…" aria-label="Search frames" />
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="chip-row frames-totals">
          <span className="chip">{totals.count} frame{totals.count === 1 ? '' : 's'}{month ? ` · ${month}` : ''}</span>
          <span className="chip">billed <b>{formatCurrency(totals.total)}</b></span>
          <span className="chip">collected <b className="money-green">{formatCurrency(totals.collected)}</b></span>
          {totals.due > 0 && <span className="chip">due left <b className="money-red">{formatCurrency(totals.due)}</b></span>}
        </div>
      )}

      <InsightsCard compact scopes={['live', 'revenue', 'members']} max={3} title="Smart Insights · Frames" />

      {filtered.length === 0 ? (
        <EmptyState title="No frames billed yet" hint="Confirm a table bill to see it here." />
      ) : (
        <div className="stack-sm">
          {filtered.map((f) => (
            <Card key={f.id} className="frame-card">
              <div className="bill-card-head">
                <div className="pc-namerow">
                  <span className="pc-name">{f.tableName}</span>
                  <Badge kind={f.status === 'paid' ? 'green' : f.status === 'partial' ? 'blue' : 'red'}>{titleCase(f.status)}</Badge>
                  <Badge kind="muted">{f.matchMode === '2v2' ? '2v2' : 'Solo'}</Badge>
                  {f.winningTeam && <Badge kind="gold">Team {f.winningTeam} won</Badge>}
                  <Badge kind="muted">{modeBadge(f.paymentMode)}</Badge>
                </div>
                <div className="row">
                  <span className="muted small">{formatDateTime(f.createdAt)} · {formatDuration(f.durationMinutes)}</span>
                  <button className="btn-icon" aria-label="Print receipt" title="Print receipt" onClick={() => setReceipt(frameReceipt(f, data?.club.name ?? 'Club'))}>
                    <Printer size={12} />
                  </button>
                  <Btn size="sm" variant="ghost" onClick={() => setWinnerFrame(f)}>
                    <Repeat size={11} /> Change Winner
                  </Btn>
                </div>
              </div>

              <div className="chip-row">
                {f.matchMode === '2v2' ? (
                  <>
                    <span className="chip team-A">A: {f.players.filter((p) => p.team === 'A').map((p) => p.label).join(' · ')}</span>
                    <span className="chip team-B">B: {f.players.filter((p) => p.team === 'B').map((p) => p.label).join(' · ')}</span>
                  </>
                ) : (
                  f.players.map((p) => (
                    <span key={p.id} className={`chip${(f.winners ?? []).includes(p.label) ? ' chip-win' : ''}`}>{p.label}</span>
                  ))
                )}
              </div>

              <div className="frame-lines muted small">
                <span>Winner: <b className="money-green">{(f.winners ?? []).join(', ') || '—'}</b></span>
                <span>Pays: <b className="money-red">{(f.losers ?? []).join(', ') || '—'}</b></span>
                {(f.items ?? []).length > 0 && (
                  <span>Items: {f.items.map((i) => `${i.name} x${i.qty}`).join(', ')}</span>
                )}
                {f.membershipDiscount > 0 && (
                  <span>Premium -{formatCurrency(f.membershipDiscount)}{f.membershipMemberName ? ` (${f.membershipMemberName})` : ''}</span>
                )}
                {f.passTableCredit > 0 && <span>Pass -{formatCurrency(f.passTableCredit)} ({f.passMemberName})</span>}
                {(f.oldDueAmount ?? 0) > 0 && <span>Old due {formatCurrency(f.oldDueAmount)}</span>}
                {(f.advancePaid ?? 0) > 0 && <span>Advance {formatCurrency(f.advancePaid)} applied</span>}
              </div>

              {(f.settlements ?? []).length > 0 && (
                <div className="frame-settlements">
                  {f.settlements.map((s, i) => (
                    <span key={i} className="small">{settlementLine(s)}</span>
                  ))}
                </div>
              )}

              <div className="bill-rows compact">
                <div className="bill-row"><span>Table</span><b>{formatCurrency(f.tableAmount)}</b></div>
                {f.itemsAmount > 0 && <div className="bill-row"><span>Items</span><b>{formatCurrency(f.itemsAmount)}</b></div>}
                {(f.gloveCharges ?? 0) > 0 && <div className="bill-row"><span>Gloves not returned</span><b>+{formatCurrency(f.gloveCharges)}</b></div>}
                <div className="bill-row total"><span>Total</span><b>{formatCurrency(f.totalAmount)}</b></div>
                <div className="bill-row"><span>Paid</span><b className="money-green">{formatCurrency(f.paidAmount)}</b></div>
                {f.dueAmount > 0 && <div className="bill-row neg"><span>Due</span><b>{formatCurrency(f.dueAmount)}</b></div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {winnerFrame && <WinnerModal frame={winnerFrame} onClose={() => setWinnerFrame(null)} />}
      <ReceiptModal open={!!receipt} onClose={() => setReceipt(null)} receipt={receipt} />
    </div>
  )
}
