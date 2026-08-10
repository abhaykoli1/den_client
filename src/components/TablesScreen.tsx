import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Banknote, Hand, Play, Plus, RotateCcw, Square, StickyNote } from 'lucide-react'
import { useClub } from '../context/ClubContext'
import { useToast } from '../context/ToastContext'
import {
  calcTableAmount,
  effectiveRate,
  formatClock,
  formatCurrency,
  formatDuration,
  formatHour,
  formatHourRange,
  maxPayingDiscount,
  parseNum,
  peakWindowActive,
  planValid,
} from '../lib/format'
import { Badge, Btn, Card, EmptyState, Field, Modal, Seg, Select, StatCard, TextArea, TextInput } from './ui'
import InsightsCard from './InsightsCard'
import ReceiptModal, { frameReceipt, type ReceiptData } from './ReceiptModal'
import type {
  ActiveSession,
  ClubTable,
  FrameRecord,
  MatchMode,
  Member,
  MenuItem,
  PaymentMode,
  SessionPlayer,
  Team,
} from '../types'

type Seat = { memberId: string | null; guestName: string; team: Team }

// ============================================================== Free table

function FreeCard({ table }: { table: ClubTable }) {
  const { data, mutate } = useClub()
  const toast = useToast()
  const members = useMemo(() => (data?.members ?? []).filter((m) => m.active), [data])
  const [mode, setMode] = useState<MatchMode>('solo')
  const [count, setCount] = useState(2)
  const [seats, setSeats] = useState<Seat[]>([])
  const [gloveSeats, setGloveSeats] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const glovePrice = table.rate.glovePrice ?? 0

  useEffect(() => {
    const n = mode === '2v2' ? 4 : count
    setSeats((prev) =>
      Array.from({ length: n }, (_, i) => {
        const old = prev[i]
        return {
          memberId: old?.memberId ?? null,
          guestName: old?.guestName ?? '',
          team: old?.team ?? (i < 2 ? 'A' : 'B'),
        }
      }),
    )
  }, [mode, count])

  const usedMembers = new Set(seats.map((s) => s.memberId).filter(Boolean) as string[])
  const rate = effectiveRate(table, seats.length || 2)
  const peakNow = peakWindowActive(table.rate)
  const seatLabel = (s: Seat, i: number) => {
    if (s.memberId) return members.find((m) => m.id === s.memberId)?.name || `Player ${i + 1}`
    return s.guestName.trim() || `Guest ${i + 1}`
  }
  const teamCount = (t: Team) => seats.filter((s) => s.team === t).length

  const toggleGloveSeat = (i: number) =>
    setGloveSeats((list) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i]))

  const start = async () => {
    if (mode === '2v2' && (teamCount('A') !== 2 || teamCount('B') !== 2)) {
      toast.error('2v2 needs exactly two players in Team A and two in Team B')
      return
    }
    setBusy(true)
    const players = seats.map((s, i) => ({
      label: seatLabel(s, i),
      type: s.memberId ? 'member' : 'guest',
      memberId: s.memberId || undefined,
      team: mode === '2v2' ? s.team : undefined,
    }))
    const r = await mutate(`sessions`, {
      body: {
        tableId: table.id,
        matchMode: mode,
        players,
        ...(glovePrice > 0 && gloveSeats.length > 0
          ? { gloveSeatIndexes: gloveSeats.filter((i) => i < seats.length) }
          : {}),
      },
      toast: `Session started · ${table.name}${gloveSeats.length > 0 ? ` · gloves out ×${gloveSeats.length}` : ''}`,
    })
    setBusy(false)
    if (r) {
      setSeats([])
      setGloveSeats([])
    }
  }

  return (
    <Card className="table-card">
      <div className="tc-head">
        <div>
          <div className="tc-name">{table.name}</div>
          <div className="muted small">
            {formatCurrency(rate)}/hr · min {formatCurrency(table.rate.minCharge)}
            {table.rate.peakHourlyRate ? (
              peakNow
                ? <span className="money-gold"> · peak till {formatHour(table.rate.peakEndHour ?? 0)}</span>
                : <> · peak {formatCurrency(table.rate.peakHourlyRate)}/hr {formatHourRange(table.rate.peakStartHour ?? 0, table.rate.peakEndHour ?? 0)}</>
            ) : null}
            {glovePrice > 0 && <> · glove {formatCurrency(glovePrice)}</>}
          </div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {peakNow && <Badge kind="dark">peak rate</Badge>}
          <Badge kind="green">Free</Badge>
        </div>
      </div>

      <div className="tc-controls">
        <Seg
          ariaLabel="Match mode"
          value={mode}
          onChange={(v) => setMode(v as MatchMode)}
          options={[
            { value: 'solo', label: 'Solo' },
            { value: '2v2', label: '2v2' },
          ]}
        />
        {mode === 'solo' && (
          <Seg
            ariaLabel="Player count"
            value={String(count)}
            onChange={(v) => setCount(parseInt(v, 10))}
            options={[
              { value: '2', label: '2P' },
              { value: '3', label: '3P' },
              { value: '4', label: '4P' },
            ]}
          />
        )}
      </div>

      <div className="seat-list">
        {seats.map((seat, i) => {
          const others = new Set([...usedMembers].filter((id) => id !== seat.memberId))
          return (
            <div className="seat-row" key={i}>
              <span className="seat-num">{mode === '2v2' ? seat.team : `P${i + 1}`}</span>
              <Select
                value={seat.memberId ?? ''}
                aria-label={`Player ${i + 1}`}
                onChange={(e) =>
                  setSeats((list) =>
                    list.map((s, j) =>
                      j === i
                        ? { ...s, memberId: e.target.value || null, guestName: '' }
                        : s,
                    ),
                  )
                }
              >
                <option value="">Guest</option>
                {members.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                    disabled={others.has(m.id)}
                    style={m.dueAmount > 0 ? { color: 'var(--accent-red)', fontWeight: 700 } : undefined}
                  >
                    {m.name}
                    {m.dueAmount > 0 ? ` (due ${formatCurrency(m.dueAmount)})` : ''}
                  </option>
                ))}
              </Select>
              {!seat.memberId && (
                <TextInput
                  value={seat.guestName}
                  placeholder={`Guest ${i + 1}`}
                  aria-label={`Guest name ${i + 1}`}
                  onChange={(e) =>
                    setSeats((list) =>
                      list.map((s, j) => (j === i ? { ...s, guestName: e.target.value } : s)),
                    )
                  }
                />
              )}
              {mode === '2v2' && (
                <Seg
                  ariaLabel={`Team for player ${i + 1}`}
                  value={seat.team}
                  onChange={(v) =>
                    setSeats((list) => list.map((s, j) => (j === i ? { ...s, team: v as Team } : s)))
                  }
                  options={[
                    { value: 'A', label: 'A' },
                    { value: 'B', label: 'B' },
                  ]}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* glove assignment — price set per table in Settings */}
      {glovePrice > 0 && (
        <div className="stack-xs">
          <span className="field-label">
            Gloves · {formatCurrency(glovePrice)}/piece — added to the frame bill if not returned
          </span>
          <div className="chip-row">
            {seats.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`chip${gloveSeats.includes(i) ? ' glove' : ''}`}
                title={gloveSeats.includes(i) ? 'Glove assigned — tap to remove' : 'Assign a glove to this player'}
                onClick={() => toggleGloveSeat(i)}
              >
                <Hand size={9} /> {seatLabel(s, i)}
              </button>
            ))}
          </div>
        </div>
      )}

      <Btn variant="green" className="btn-block" loading={busy} onClick={start}>
        <Play size={13} /> Start Table · {formatCurrency(rate)}/hr
      </Btn>
    </Card>
  )
}

// ========================================================== Occupied table

// ------------------------------------------------------- quick actions

function AdvanceModal({ session, table, onClose }: { session: ActiveSession; table: ClubTable; onClose: () => void }) {
  const { mutate } = useClub()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<'cash' | 'upi' | 'card'>('cash')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const amt = parseNum(amount)
    if (amt <= 0) {
      toast.error('Enter a valid advance amount')
      return
    }
    setBusy(true)
    const r = await mutate(`sessions/${session.id}/advance`, {
      body: { amount: amt, mode },
      toast: `Advance collected · ${table.name} · ${formatCurrency(amt)} ${mode.toUpperCase()}`,
    })
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Advance · ${table.name}`}
      width={340}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={parseNum(amount) <= 0} onClick={save}>Collect Advance</Btn>
        </>
      }
    >
      <p className="muted small">
        Already received <b className="money-green">{formatCurrency(session.advancePaid ?? 0)}</b> advance.
        A new advance joins today’s collection (day-close) instantly and adjusts on the final bill.
      </p>
      <div className="form-grid" style={{ marginTop: 8 }}>
        <Field label="Amount">
          <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <Field label="Mode">
          <Seg
            value={mode}
            onChange={(v) => setMode(v as 'cash' | 'upi' | 'card')}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'upi', label: 'UPI' },
              { value: 'card', label: 'Card' },
            ]}
          />
        </Field>
      </div>
    </Modal>
  )
}

function NoteModal({ session, table, onClose }: { session: ActiveSession; table: ClubTable; onClose: () => void }) {
  const { mutate } = useClub()
  const [notes, setNotes] = useState(session.notes ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const r = await mutate(`sessions/${session.id}`, {
      method: 'PATCH',
      body: { notes },
      toast: `Session note saved · ${table.name}`,
    })
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Note · ${table.name}`}
      width={340}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} onClick={save}>Save Note</Btn>
        </>
      }
    >
      <p className="muted small">A VIP request, a reserved item, or any note — it rides along until the final bill.</p>
      <div className="form-grid" style={{ marginTop: 8 }}>
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="e.g. Paneer tikka order at 8pm, VIP members" autoFocus />
      </div>
    </Modal>
  )
}

function MoveModal({ session, table, onClose }: { session: ActiveSession; table: ClubTable; onClose: () => void }) {
  const { data, mutate } = useClub()
  const toast = useToast()
  const [targetId, setTargetId] = useState('')
  const [busy, setBusy] = useState(false)
  const busyTables = new Set((data?.sessions ?? []).map((s) => s.tableId))
  const freeTables = (data?.tables ?? []).filter((t) => t.active && t.id !== table.id && !busyTables.has(t.id))

  const save = async () => {
    if (!targetId) {
      toast.error('Pick the new table first')
      return
    }
    setBusy(true)
    const r = await mutate(`sessions/${session.id}/move`, {
      body: { tableId: targetId },
      toast: `Session moved · ${data?.tables.find((t) => t.id === targetId)?.name ?? 'new table'}`,
    })
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Move Session · ${table.name}`}
      width={340}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={!targetId} onClick={save}>Move Here</Btn>
        </>
      }
    >
      <p className="muted small">
        The timer keeps running from the original start — only the table changes. The new table’s rate applies.
      </p>
      <div className="form-grid" style={{ marginTop: 8 }}>
        <Field label="Move to (free tables)">
          {freeTables.length === 0 ? (
            <p className="muted small">No table is free right now.</p>
          ) : (
            <Select value={targetId} onChange={(e) => setTargetId(e.target.value)} autoFocus>
              <option value="">Select table…</option>
              {freeTables.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {formatCurrency(t.rate.hourlyRate)}/hr</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}

function OccupiedCard({ table, session }: { table: ClubTable; session: ActiveSession }) {
  const { data, mutate } = useClub()
  const menu = useMemo(() => (data?.menuItems ?? []).filter((m) => m.active), [data])
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [itemBusy, setItemBusy] = useState<string | null>(null)
  const [qaModal, setQaModal] = useState<'advance' | 'note' | 'move' | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const elapsedSec = Math.max(0, (now - new Date(session.startedAt).getTime()) / 1000)
  const stoppedAt = new Date(now).toISOString()
  const est = calcTableAmount(session.startedAt, stoppedAt, session.hourlyRate, session.minCharge)

  const stop = async () => {
    setBusy(true)
    await mutate(`sessions/${session.id}/stop`, { toast: `Session stopped · ${table.name}` })
    setBusy(false)
  }

  const addItem = async (itemId: string) => {
    setItemBusy(itemId)
    await mutate(`sessions/${session.id}/items`, {
      body: { items: [{ itemId, qty: 1 }] },
      toast: 'Item added to session',
    })
    setItemBusy(null)
  }

  const attached = session.items ?? []
  const attachedTotal = attached.reduce((s, l) => s + (l.amount ?? 0), 0)

  return (
    <Card className="table-card occupied">
      <div className="tc-head">
        <div>
          <div className="tc-name">{table.name}</div>
          <div className="muted small">
            {formatCurrency(session.hourlyRate)}/hr{session.matchMode === '2v2' ? ' · 2v2' : ''}
          </div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {session.peak && <Badge kind="dark">peak rate</Badge>}
          <Badge kind="gold">Occupied</Badge>
        </div>
      </div>
      <div className="tc-timer">
        <span className="timer">{formatClock(elapsedSec)}</span>
        <span className="tc-est">
          ≈ {formatCurrency(est.amount)} <span className="muted small">so far · {est.minutes}m running</span>
        </span>
      </div>
      <PlayerChips players={session.players} matchMode={session.matchMode} />
      <GloveChips session={session} />
      {(session.advancePaid ?? 0) > 0 && (
        <p className="small money-green qa-hint"><Banknote size={11} /> Advance received {formatCurrency(session.advancePaid)} — will adjust on the bill</p>
      )}
      {session.notes && (
        <p className="muted small qa-hint"><StickyNote size={11} /> {session.notes}</p>
      )}

      {/* mid-session items — tap to add while the timer runs */}
      {menu.length > 0 && (
        <div className="chip-row item-chips sm">
          {menu.slice(0, 10).map((m) => (
            <button
              key={m.id}
              type="button"
              className="item-chip sm"
              disabled={m.stockQty <= 0 || itemBusy !== null}
              title={m.stockQty <= 0 ? 'Out of stock' : `${m.stockQty} in stock · add 1 to this session`}
              onClick={() => void addItem(m.id)}
            >
              <Plus size={9} />
              <span className="item-chip-name">{m.name}</span>
              <span className="money-gold">{formatCurrency(m.price)}</span>
            </button>
          ))}
        </div>
      )}
      {attached.length > 0 && (
        <div className="session-items">
          <div className="chip-row">
            {attached.map((l) => (
              <span key={l.itemId} className="chip sm-chip">
                {l.name} ×{l.qty} · <b className="money-gold">{formatCurrency(l.amount)}</b>
              </span>
            ))}
          </div>
          <p className="muted small">Items on this table · {formatCurrency(attachedTotal)} — added on the final bill automatically.</p>
        </div>
      )}

      <div className="qa-row">
        <Btn size="sm" variant="ghost" onClick={() => setQaModal('advance')} title="Collect advance">
          <Banknote size={12} /> Advance
        </Btn>
        <Btn size="sm" variant="ghost" onClick={() => setQaModal('note')} title="Session note">
          <StickyNote size={12} /> Note
        </Btn>
        <Btn size="sm" variant="ghost" onClick={() => setQaModal('move')} title="Move to another table">
          <ArrowRightLeft size={12} /> Move
        </Btn>
      </div>

      <Btn variant="red" className="btn-block" loading={busy} onClick={stop}>
        <Square size={12} /> Stop &amp; Final Bill
      </Btn>

      {qaModal === 'advance' && <AdvanceModal session={session} table={table} onClose={() => setQaModal(null)} />}
      {qaModal === 'note' && <NoteModal session={session} table={table} onClose={() => setQaModal(null)} />}
      {qaModal === 'move' && <MoveModal session={session} table={table} onClose={() => setQaModal(null)} />}
    </Card>
  )
}

/** Glove chips — gold = still out (will be charged), green = returned. Tap to toggle. */
function GloveChips({ session }: { session: ActiveSession }) {
  const { mutate } = useClub()
  const gloves = session.gloves ?? []
  if (gloves.length === 0) return null

  const toggle = (playerId: string, returned: boolean, label: string) =>
    void mutate(`sessions/${session.id}/gloves/return`, {
      body: { playerId, returned },
      toast: returned
        ? `Glove returned · ${label} — no charge`
        : `Glove back out · ${label} — charged to the bill if not returned`,
    })

  return (
    <div className="stack-xs">
      <span className="field-label">Gloves — tap when returned</span>
      <div className="chip-row">
        {gloves.map((g) => (
          <button
            key={g.playerId}
            type="button"
            className={`chip glove${g.returned ? ' returned' : ''}`}
            title={g.returned ? 'Returned — no charge' : `Out — ${formatCurrency(g.price)} charged if not returned by billing`}
            onClick={() => toggle(g.playerId, !g.returned, g.label)}
          >
            <Hand size={9} /> {g.label} · {g.returned ? 'returned' : formatCurrency(g.price)}
          </button>
        ))}
      </div>
    </div>
  )
}

function PlayerChips({ players, matchMode }: { players: SessionPlayer[]; matchMode: MatchMode }) {
  return (
    <div className="chip-row">
      {players.map((p) => (
        <span key={p.id} className={`chip${matchMode === '2v2' ? ` team-${p.team}` : ''}`}>
          {matchMode === '2v2' ? `${p.team} · ` : ''}
          {p.label}
        </span>
      ))}
    </div>
  )
}

// ========================================================== Final bill

interface Estimate {
  tableAmount: number
  minutes: number
  itemsTotal: number
  itemLines: number
  gloveCharges: number
  gloveMissing: number
  bonus: number
  manualDiscount: number
  membershipDiscount: number
  membershipPct: number
  membershipName: string | null
  passCredit: number
  passName: string | null
  passFramesLeft: number | null
  frameAmount: number
  oldDue: number
  total: number
  walletCover: number
  walletBy: Array<{ name: string; amount: number }>
  losers: SessionPlayer[]
  losingMembers: Member[]
}

function estimateBill(
  session: ActiveSession,
  losers: SessionPlayer[],
  memberById: Map<string, Member>,
  qty: Record<string, number>,
  menu: MenuItem[],
  discountIn: number,
  settings: { winnerBonus: number; monthlyTableDiscount: number },
): Estimate {
  const { amount: tableAmount, minutes } = calcTableAmount(
    session.startedAt,
    session.endedAt!,
    session.hourlyRate,
    session.minCharge,
  )
  const items = menu.filter((m) => (qty[m.id] ?? 0) > 0)
  const attachedItems = session.items ?? []
  const attachedTotal = attachedItems.reduce((s, l) => s + (l.amount ?? 0), 0)
  const itemsTotal = attachedTotal + items.reduce((s, m) => s + (qty[m.id] ?? 0) * m.price, 0)
  const bonus = settings.winnerBonus || 0
  const losingMembers = losers
    .map((p) => (p.memberId ? memberById.get(p.memberId) : undefined))
    .filter((m): m is Member => Boolean(m))

  const { pct, name } = maxPayingDiscount(losingMembers, settings.monthlyTableDiscount || 0)
  const membershipDiscount = Math.round(((tableAmount * pct) / 100) * 100) / 100

  let passCredit = 0
  let passName: string | null = null
  let passFramesLeft: number | null = null
  for (const m of losingMembers) {
    if ((m.passFramesLeft ?? 0) < 1 || !planValid(m.planExpiresAt) || m.dueAmount > 0) continue
    const credit = Math.min(session.hourlyRate, tableAmount - membershipDiscount)
    if (credit > 0) {
      passCredit = Math.round(credit * 100) / 100
      passName = m.name
      passFramesLeft = m.passFramesLeft ?? 0
      break
    }
  }

  const manualDiscount = Math.min(discountIn, tableAmount + itemsTotal + bonus)
  // Unreturned gloves join the frame money AFTER all discounts (backend rules).
  const glovesOut = (session.gloves ?? []).filter((g) => !g.returned)
  const gloveCharges = Math.round(glovesOut.reduce((s, g) => s + (g.price || 0), 0) * 100) / 100
  const frameAmount =
    Math.max(
      0,
      Math.round((tableAmount + itemsTotal + bonus - manualDiscount - membershipDiscount - passCredit) * 100) / 100,
    ) + gloveCharges
  const oldDue = losingMembers.reduce((s, m) => s + (m.dueAmount || 0), 0)
  const total = frameAmount + oldDue
  const share = losers.length ? frameAmount / losers.length : 0
  const walletBy = losingMembers
    .map((m) => ({ name: m.name, amount: Math.min(m.walletBalance || 0, share) }))
    .filter((w) => w.amount > 0)
  const walletCover = walletBy.reduce((s, w) => s + w.amount, 0)
  const itemLines = attachedItems.length + items.length

  return {
    tableAmount, minutes, itemsTotal, itemLines, gloveCharges, gloveMissing: glovesOut.length, bonus, manualDiscount,
    membershipDiscount, membershipPct: pct, membershipName: name,
    passCredit, passName, passFramesLeft, frameAmount, oldDue, total,
    walletCover, walletBy, losers, losingMembers,
  }
}

function FinalBillCard({ table, session, onConfirmed }: { table: ClubTable; session: ActiveSession; onConfirmed?: (frame: FrameRecord) => void }) {
  const { data, stats, mutate } = useClub()
  const toast = useToast()
  const members = data?.members ?? []
  const menu = (data?.menuItems ?? []).filter((m) => m.active)
  const settings = data?.club.settings
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  const [winners, setWinners] = useState<string[]>([])
  const [teamPick, setTeamPick] = useState<Team | null>(null)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [discount, setDiscount] = useState('0')
  const [mode, setMode] = useState<PaymentMode | null>(null)
  const [paid, setPaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const is2v2 = session.matchMode === '2v2'
  const losers = useMemo(() => {
    if (is2v2) return teamPick ? session.players.filter((p) => p.team !== teamPick) : []
    return session.players.filter((p) => !winners.includes(p.id))
  }, [is2v2, teamPick, winners, session.players])
  const validSides = is2v2 ? teamPick !== null : winners.length >= 1 && losers.length >= 1

  const est = useMemo(
    () =>
      estimateBill(
        session,
        validSides ? losers : [],
        memberById,
        qty,
        menu,
        parseNum(discount),
        { winnerBonus: settings?.winnerBonus ?? 0, monthlyTableDiscount: settings?.monthlyTableDiscount ?? 0 },
      ),
    [session, losers, validSides, memberById, qty, menu, discount, settings],
  )

  // Auto-select Wallet when a losing member has wallet (spec) — until user touches mode.
  const autoMode: PaymentMode =
    mode ?? (est.losingMembers.some((m) => (m.walletBalance ?? 0) > 0) ? 'wallet' : 'cash')
  const isDue = autoMode === 'due'
  const advance = session.advancePaid ?? 0 // already collected mid-session; offsets the bill
  const defaultPaid = isDue || autoMode === 'wallet' ? 0 : Math.max(0, Math.round((est.total - est.walletCover - advance) * 100) / 100)
  const paidNum = isDue ? 0 : paid === null ? defaultPaid : Math.max(0, parseNum(paid))

  const walletUsed = isDue ? 0 : est.walletCover
  const estDueLeft = Math.max(0, Math.round((est.total - walletUsed - advance - paidNum) * 100) / 100)
  const overLimit =
    estDueLeft > 0 &&
    (stats?.dueLimit ?? 0) > 0 &&
    (stats?.totalDue ?? 0) + estDueLeft > (stats?.dueLimit ?? 0)

  const pickTeam = (t: Team) => {
    setTeamPick((cur) => (cur === t ? null : t))
  }
  const toggleWinner = (id: string) => {
    setWinners((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }
  const bumpQty = (itemId: string, delta: number) => {
    setQty((q) => {
      const next = Math.max(0, (q[itemId] ?? 0) + delta)
      return { ...q, [itemId]: next }
    })
  }

  const confirm = async () => {
    if (!validSides) {
      toast.error(is2v2 ? 'Select the winning team first' : 'Select at least one winner and one payer')
      return
    }
    setBusy(true)
    const body: Record<string, unknown> = {
      items: Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([itemId, q]) => ({ itemId, qty: q })),
      discount: parseNum(discount),
      paymentMode: autoMode,
      paidAmount: paidNum,
    }
    if (is2v2) body.winningTeam = teamPick
    else body.winnerPlayerIds = winners
    const r = await mutate(`sessions/${session.id}/confirm`, {
      body,
      toast: `Frame bill confirmed · ${table.name}`,
    })
    setBusy(false)
    if (!r) return
    onConfirmed?.(r as FrameRecord)
  }

  const resume = async () => {
    await mutate(`sessions/${session.id}/resume`, { toast: `Session resumed · ${table.name}` })
  }

  const teamOf = (t: Team) => session.players.filter((p) => p.team === t)
  const selectedItems = menu.filter((m) => (qty[m.id] ?? 0) > 0)

  return (
    <Card className="table-card final">
      <div className="tc-head">
        <div>
          <div className="tc-name">{table.name}</div>
          <div className="muted small">
            Stopped · {formatDuration(est.minutes)}
            {session.matchMode === '2v2' ? ' · 2v2' : ''}
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Badge kind="blue">Final Bill</Badge>
          <Btn size="sm" variant="ghost" onClick={resume} title="Resume session">
            <RotateCcw size={11} /> Resume
          </Btn>
        </div>
      </div>

      {/* winner / team selection */}
      {is2v2 ? (
        <div className="team-pick">
          {(['A', 'B'] as Team[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`team-btn${teamPick === t ? ' active' : ''}`}
              onClick={() => pickTeam(t)}
            >
              <span className="team-title">Team {t}</span>
              <span className="team-names">
                {teamOf(t).map((p, i) => (
                  <span key={p.id} className={p.memberId && (memberById.get(p.memberId)?.dueAmount ?? 0) > 0 ? 'money-red' : ''}>
                    {i > 0 ? ' · ' : ''}{p.label}
                  </span>
                ))}
              </span>
              <span className={`team-role ${teamPick === t ? 'money-green' : 'money-red'}`}>
                {teamPick === t ? 'Winner' : 'Pays'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="winner-pick">
          {session.players.map((p) => {
            const win = winners.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                className={`win-chip${win ? ' win' : ''}`}
                onClick={() => toggleWinner(p.id)}
                title={win ? 'Winner' : 'Pays'}
              >
                <span className={p.memberId && (memberById.get(p.memberId)?.dueAmount ?? 0) > 0 ? 'money-red' : ''}>{p.label}</span>
                <span className={win ? 'money-green' : 'money-red'}>{win ? 'Winner' : 'Pays'}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* gloves — return them here before confirming to drop their charge */}
      <GloveChips session={session} />
      {est.gloveCharges > 0 && (
        <p className="small warn-text" style={{ margin: '2px 0 0' }}>
          <Hand size={10} /> {est.gloveMissing} glove{est.gloveMissing === 1 ? '' : 's'} × {formatCurrency(est.gloveCharges)} is joining the frame bill — tap above once returned.
        </p>
      )}

      {/* items */}
      {menu.length > 0 && (
        <div className="chip-row item-chips">
          {menu.slice(0, 14).map((m) => (
            <button key={m.id} type="button" className={`item-chip${(qty[m.id] ?? 0) > 0 ? ' has-qty' : ''}`} onClick={() => bumpQty(m.id, 1)}>
              <Plus size={10} />
              <span className="item-chip-name">{m.name}</span>
              <span className="money-gold">{formatCurrency(m.price)}</span>
              {(qty[m.id] ?? 0) > 0 && <span className="qty-badge">{qty[m.id]}</span>}
            </button>
          ))}
        </div>
      )}
      {selectedItems.length > 0 && (
        <div className="sel-items">
          {selectedItems.map((m) => (
            <div className="sel-item" key={m.id}>
              <span className="sel-item-name">{m.name}</span>
              <span className="qty-ctl">
                <button aria-label="Decrease" onClick={() => bumpQty(m.id, -1)}>-</button>
                <b>{qty[m.id]}</b>
                <button aria-label="Increase" onClick={() => bumpQty(m.id, 1)}>+</button>
              </span>
              <span className="money-gold small">{formatCurrency((qty[m.id] ?? 0) * m.price)}</span>
            </div>
          ))}
        </div>
      )}

      {/* money controls */}
      <div className="bill-controls">
        <label className="field">
          <span className="field-label">Discount</span>
          <TextInput inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Payment Mode</span>
          <Select value={autoMode} onChange={(e) => { setMode(e.target.value as PaymentMode); setPaid(null) }}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="wallet">Wallet</option>
            <option value="mixed">Mixed</option>
            <option value="due">Add to Due</option>
          </Select>
        </label>
        <label className="field">
          <span className="field-label">{isDue ? 'Paid (locked)' : 'Paid'}</span>
          <TextInput
            inputMode="decimal"
            value={isDue ? '0' : paid === null ? String(defaultPaid) : paid}
            disabled={isDue}
            onChange={(e) => setPaid(e.target.value)}
          />
        </label>
      </div>
      {walletUsed > 0 && (
        <p className="small money-gold">
          Wallet auto-applies first: -{formatCurrency(walletUsed)}
          {est.walletBy.length > 0 && (
            <span className="muted"> ({est.walletBy.map((w) => `${w.name} -${formatCurrency(w.amount)}`).join(', ')})</span>
          )}
        </p>
      )}

      {/* bill rows */}
      <div className="bill-rows">
        <div className="bill-row"><span>Table · {formatDuration(est.minutes)}</span><b>{formatCurrency(est.tableAmount)}</b></div>
        {est.itemsTotal > 0 && <div className="bill-row"><span>Items ({est.itemLines})</span><b>{formatCurrency(est.itemsTotal)}</b></div>}
        {est.gloveCharges > 0 && <div className="bill-row"><span>Gloves not returned ({est.gloveMissing})</span><b>+{formatCurrency(est.gloveCharges)}</b></div>}
        {est.bonus > 0 && <div className="bill-row"><span>Winner bonus</span><b>+{formatCurrency(est.bonus)}</b></div>}
        {est.membershipDiscount > 0 && (
          <div className="bill-row neg"><span>Premium {est.membershipName ? `· ${est.membershipName} ` : ''}{est.membershipPct}%</span><b>-{formatCurrency(est.membershipDiscount)}</b></div>
        )}
        {est.passCredit > 0 && (
          <div className="bill-row neg">
            <span>Frame pass · {est.passName}{est.passFramesLeft !== null ? ` (${est.passFramesLeft} frame${est.passFramesLeft === 1 ? '' : 's'} left)` : ''}</span>
            <b>-{formatCurrency(est.passCredit)}</b>
          </div>
        )}
        {est.oldDue > 0 && <div className="bill-row"><span>Old due</span><b>{formatCurrency(est.oldDue)}</b></div>}
        {est.manualDiscount > 0 && <div className="bill-row neg"><span>Manual discount</span><b>-{formatCurrency(est.manualDiscount)}</b></div>}
        <div className="bill-row total"><span>Total</span><b>{formatCurrency(est.total)}</b></div>
        {advance > 0 && <div className="bill-row neg"><span>Advance already received</span><b>-{formatCurrency(advance)}</b></div>}
        <div className={`bill-row ${estDueLeft > 0 ? 'neg' : 'pos'}`}><span>Estimated due left</span><b>{formatCurrency(estDueLeft)}</b></div>
      </div>

      {overLimit && (
        <p className="small warn-text">
          Due limit {formatCurrency(stats?.dueLimit)} will be exceeded (total due {formatCurrency((stats?.totalDue ?? 0) + estDueLeft)}).
        </p>
      )}

      <Btn variant="green" className="btn-block" loading={busy} disabled={!validSides} onClick={confirm}>
        Confirm Bill · {formatCurrency(validSides ? est.total : 0)}
      </Btn>
      <p className="muted small center">Final amounts are computed by the server.</p>
    </Card>
  )
}

// ================================================================= screen

export default function TablesScreen() {
  const { data, stats } = useClub()
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const tables = data?.tables ?? []
  const sessions = data?.sessions ?? []
  const byTable = new Map(sessions.map((s) => [s.tableId, s]))

  return (
    <div className="stack">
      <div className="grid-stats">
        <StatCard label="Total Due" tone="red" value={formatCurrency(stats?.totalDue ?? 0)} sub={`${stats?.activeMembers ?? 0} active members`} />
        <StatCard label="Daily Earnings" tone="green" value={formatCurrency(stats?.todayEarnings ?? 0)} sub="PAYMENT ledger · today" />
        <StatCard label="Due Limit" tone="blue" value={formatCurrency(stats?.dueLimit ?? 0)} sub={(stats?.totalDue ?? 0) > (stats?.dueLimit ?? 0) ? 'Limit exceeded' : 'Club setting'} />
      </div>

      <InsightsCard compact scopes={['live', 'members', 'stock', 'revenue']} max={4} title="Smart Insights · Today" />

      {tables.length === 0 ? (
        <EmptyState title="No tables yet" hint="Add tables from Settings → Table Pricing." />
      ) : (
        <div className="table-grid">
          {tables.map((t) => {
            const session = byTable.get(t.id)
            if (!t.active && !session) {
              return (
                <Card key={t.id} className="table-card disabled">
                  <div className="tc-head">
                    <div className="tc-name">{t.name}</div>
                    <Badge kind="muted">Disabled</Badge>
                  </div>
                  <p className="muted small">Enable this table from Settings.</p>
                </Card>
              )
            }
            if (!session) return <FreeCard key={t.id} table={t} />
            if (session.endedAt) return <FinalBillCard key={t.id} table={t} session={session} onConfirmed={(frame) => setReceipt(frameReceipt(frame, data?.club.name ?? 'Club'))} />
            return <OccupiedCard key={t.id} table={t} session={session} />
          })}
        </div>
      )}
      <ReceiptModal open={!!receipt} onClose={() => setReceipt(null)} receipt={receipt} />
    </div>
  )
}
