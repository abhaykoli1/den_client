import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Ban,
  Crown,
  Pencil,
  Play,
  Plus,
  Timer,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { api, asArray } from '../lib/api'
import { useClub } from '../context/ClubContext'
import { useToast } from '../context/ToastContext'
import {
  formatClock,
  formatCurrency,
  formatDate,
  formatDateTime,
  parseNum,
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
  Select,
  StatCard,
  TextInput,
} from './ui'
import InsightsCard from './InsightsCard'
import type { ClubTable, Member, Tournament, TournamentMatch, TournamentPlayer } from '../types'

// --------------------------------------------------------------- helpers

const STATUS_KIND: Record<Tournament['status'], 'gold' | 'green' | 'blue' | 'red'> = {
  upcoming: 'gold',
  running: 'green',
  completed: 'blue',
  cancelled: 'red',
}

function groupRounds(t: Tournament): TournamentMatch[][] {
  const rounds = new Map<number, TournamentMatch[]>()
  for (const m of t.matches ?? []) {
    const list = rounds.get(m.round) ?? []
    list.push(m)
    rounds.set(m.round, list)
  }
  return [...rounds.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list)
}

function matchRate(t: Tournament, match: TournamentMatch, tables: ClubTable[]): number {
  if (t.tableRate > 0) return t.tableRate
  const tbl = tables.find((x) => x.id === match.tableId)
  return tbl?.rate.hourlyRate ?? 0
}

// --------------------------------------------------------------- tournament modal

function TournamentModal({
  open,
  onClose,
  tournament,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  tournament: Tournament | null
  onSaved: (t: Tournament) => void
}) {
  const { club } = useClub()
  const toast = useToast()
  const [name, setName] = useState(tournament?.name ?? '')
  const [game, setGame] = useState(tournament?.game ?? 'snooker')
  const [format, setFormat] = useState<'knockout' | 'league'>(tournament?.format ?? 'knockout')
  const [date, setDate] = useState(tournament?.date ?? new Date().toISOString().slice(0, 10))
  const [entryFee, setEntryFee] = useState(String(tournament?.entryFee ?? ''))
  const [prize1, setPrize1] = useState(String(tournament?.prize1 ?? ''))
  const [prize2, setPrize2] = useState(String(tournament?.prize2 ?? ''))
  const [tableRate, setTableRate] = useState(String(tournament?.tableRate || ''))
  const [notes, setNotes] = useState(tournament?.notes ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!club || !name.trim()) return
    setBusy(true)
    try {
      const body = {
        name: name.trim(),
        game: game.trim() || 'snooker',
        format: tournament ? undefined : format, // format locks at creation
        date,
        entryFee: parseNum(entryFee),
        prize1: parseNum(prize1),
        prize2: parseNum(prize2),
        tableRate: parseNum(tableRate),
        notes: notes.trim() || null,
      }
      const t = tournament
        ? await api<Tournament>(`/clubs/${club.id}/tournaments/${tournament.id}`, { method: 'PATCH', body })
        : await api<Tournament>(`/clubs/${club.id}/tournaments`, { method: 'POST', body })
      toast.success(tournament ? 'Tournament updated' : `Tournament created · ${t.name}`)
      onClose()
      onSaved(t)
    } catch (e: any) {
      toast.error(e?.message || 'Could not save tournament')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tournament ? `Edit · ${tournament.name}` : 'New Tournament'}
      width={440}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={!name.trim()} onClick={save}>
            {tournament ? 'Save' : 'Create Tournament'}
          </Btn>
        </>
      }
    >
      <div className="form-grid two">
        <Field label="Tournament Name *"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Snooker Open" autoFocus /></Field>
        <Field label="Game">
          <Select value={game} onChange={(e) => setGame(e.target.value)}>
            <option value="snooker">Snooker</option>
            <option value="pool">Pool</option>
            <option value="8-ball">8-Ball</option>
            <option value="9-ball">9-Ball</option>
          </Select>
        </Field>
        <Field label="Format" hint={tournament ? 'locked after creation' : 'knockout = bracket · league = round robin'}>
          <Select value={format} onChange={(e) => setFormat(e.target.value as 'knockout' | 'league')} disabled={!!tournament}>
            <option value="knockout">Knockout — single elimination</option>
            <option value="league">League — everyone plays everyone</option>
          </Select>
        </Field>
        <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Entry Fee (₹)"><TextInput inputMode="decimal" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} placeholder="100" /></Field>
        <Field label="Winner Prize (₹)"><TextInput inputMode="decimal" value={prize1} onChange={(e) => setPrize1(e.target.value)} placeholder="500" /></Field>
        <Field label="Runner-up Prize (₹)"><TextInput inputMode="decimal" value={prize2} onChange={(e) => setPrize2(e.target.value)} placeholder="200" /></Field>
        <Field label="Match Table Rate (₹/hr)" hint="0 = club table ka normal rate">
          <TextInput inputMode="decimal" value={tableRate} onChange={(e) => setTableRate(e.target.value)} placeholder="0" />
        </Field>
      </div>
      <Field label="Notes (optional)"><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="best-of-3 frames, house rules…" /></Field>
      {format === 'league' && !tournament && (
        <p className="muted small">
          League: sab players ek dusre se ek baar khelenge · jeet = 3 points · tie pe frame difference.
          Points table ka topper auto-champion banega.
        </p>
      )}
      <p className="muted small">Entry fees count as income. Loser pays each match ka table charge (rate × minutes) — tracked match-wise; prize money auto-recorded as expense at the final.</p>
    </Modal>
  )
}

// --------------------------------------------------------------- player edit modal

function PlayerEditModal({
  tournament,
  player,
  onClose,
  onSaved,
}: {
  tournament: Tournament
  player: TournamentPlayer
  onClose: () => void
  onSaved: (t: Tournament) => void
}) {
  const { club } = useClub()
  const toast = useToast()
  const [name, setName] = useState(player.name)
  const [phone, setPhone] = useState(player.phone ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!club || !name.trim()) return
    setBusy(true)
    try {
      const t = await api<Tournament>(
        `/clubs/${club.id}/tournaments/${tournament.id}/participants/${player.pid}`,
        { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() || null } },
      )
      toast.success(`Player updated · ${name.trim()}`)
      onClose()
      onSaved(t)
    } catch (e: any) {
      toast.error(e?.message || 'Could not update player')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit Player · ${player.name}`}
      width={360}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={!name.trim()} onClick={save}>Save</Btn>
        </>
      }
    >
      <div className="form-grid two">
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Phone"><TextInput inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxx01" /></Field>
      </div>
    </Modal>
  )
}

// --------------------------------------------------------------- match card

function MatchCard({
  tournament,
  match,
  tables,
  onDone,
}: {
  tournament: Tournament
  match: TournamentMatch
  tables: ClubTable[]
  onDone: (t: Tournament) => void
}) {
  const { club } = useClub()
  const toast = useToast()
  const [s1, setS1] = useState('0')
  const [s2, setS2] = useState('0')
  const [winner, setWinner] = useState<'1' | '2'>('1')
  const [tableId, setTableId] = useState('')
  const [scoreMode, setScoreMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const live = match.status === 'table_live'
  useEffect(() => {
    if (!live) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [live])

  const w1 = match.winnerPid && match.p1?.pid === match.winnerPid
  const w2 = match.winnerPid && match.p2?.pid === match.winnerPid
  const ready = tournament.status === 'running' && match.status === 'pending' && match.p1 && match.p2
  const freeTables = tables.filter((tb) => tb.active !== false)
  const rate = matchRate(tournament, match, tables)
  const liveMin = live && match.startedAt ? Math.floor((now - new Date(match.startedAt).getTime()) / 1000) : 0
  const liveEst = live && rate > 0 ? Math.round((rate / 60) * Math.max(1, Math.ceil(liveMin / 60)) * 100) / 100 : 0

  const post = async (path: string, body: unknown, okMsg: string) => {
    if (!club) return
    setBusy(true)
    try {
      const t = await api<Tournament>(
        `/clubs/${club.id}/tournaments/${tournament.id}/matches/${match.id}${path}`,
        { method: 'POST', body },
      )
      toast.success(okMsg)
      onDone(t)
    } catch (e: any) {
      toast.error(e?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const putOnTable = () =>
    post('/play', { tableId: tableId || null }, `Match on table · ${match.p1?.name} vs ${match.p2?.name}`)

  const saveResult = () =>
    post(
      '/result',
      { winner, score1: Math.floor(parseNum(s1)), score2: Math.floor(parseNum(s2)) },
      `${winner === '1' ? match.p1?.name : match.p2?.name} advances · ${match.label}`,
    )

  const scoreRow = (
    <div className="m-actions">
      <div className="m-scoreline">
        <TextInput className="m-score-in" inputMode="numeric" value={s1} onChange={(e) => setS1(e.target.value)} aria-label="Score player 1" />
        <span className="muted small">:</span>
        <TextInput className="m-score-in" inputMode="numeric" value={s2} onChange={(e) => setS2(e.target.value)} aria-label="Score player 2" />
      </div>
      <div className="row">
        <Select className="grow" value={winner} onChange={(e) => setWinner(e.target.value as '1' | '2')} aria-label="Winner">
          <option value="1">{match.p1?.name} wins</option>
          <option value="2">{match.p2?.name} wins</option>
        </Select>
        <Btn size="sm" variant="green" loading={busy} onClick={saveResult}>Save</Btn>
      </div>
    </div>
  )

  const statusChip =
    live ? (
      <span className="m-chip live"><span className="live-dot sm" />LIVE</span>
    ) : match.status === 'played' ? (
      <span className="m-chip done">done</span>
    ) : match.status === 'bye' ? (
      <span className="m-chip">bye</span>
    ) : ready ? (
      <span className="m-chip wait">ready</span>
    ) : (
      <span className="m-chip">waiting</span>
    )

  return (
    <div className={`match-card${ready || live ? ' playable' : ''}${match.status === 'played' ? ' done' : ''}`}>
      <div className="m-head">
        <span className="m-label">{match.label}</span>
        {statusChip}
      </div>

      <div className="m-slots">
        {([1, 2] as const).map((n) => {
          const p = n === 1 ? match.p1 : match.p2
          const won = (n === 1 ? w1 : w2) || false
          const score = n === 1 ? match.score1 : match.score2
          return (
            <div key={n} className={`m-row${won ? ' winner' : ''}`}>
              <span className="m-seed">P{n}</span>
              <span className="m-name">{p?.name ?? <span className="bye-tag">TBD</span>}</span>
              <span className="m-score">{match.status === 'played' || match.status === 'bye' ? score ?? 0 : '–'}</span>
            </div>
          )
        })}
      </div>

      {match.status === 'bye' && <span className="bye-tag">walkover — advances automatically</span>}

      {ready && !scoreMode && (
        <div className="m-actions">
          <Select className="m-table-sel" value={tableId} onChange={(e) => setTableId(e.target.value)} aria-label="Table">
            <option value="">Table tracker: off (pick a table to time)</option>
            {freeTables.map((tb) => (
              <option key={tb.id} value={tb.id}>⏱ {tb.name}</option>
            ))}
          </Select>
          <Btn size="sm" variant="green" loading={busy} onClick={putOnTable} className="btn-block">
            <Timer size={11} /> On Table
          </Btn>
          <button type="button" className="m-link" onClick={() => setScoreMode(true)}>
            score only — no table timer
          </button>
        </div>
      )}
      {ready && scoreMode && scoreRow}

      {live && (
        <>
          <div className="m-live">
            <span className="live-dot" />
            <b className="timer">{formatClock(liveMin)}</b>
            {match.tableName && <Badge kind="blue">{match.tableName}</Badge>}
            {rate > 0 && <span className="money-gold small">≈ {formatCurrency(liveEst)}</span>}
          </div>
          {scoreRow}
          <span className="bye-tag">the table timer stops when you save — table charge goes to the loser</span>
        </>
      )}

      {match.status === 'played' && (
        <span className="bye-tag">
          {formatDateTime(match.playedAt)}
          {match.tableAmount != null && match.tableAmount > 0 && (
            <> · table <b className="money-gold">{formatCurrency(match.tableAmount)}</b> ({match.minutes}m) · {(match.loserPid === match.p1?.pid ? match.p1 : match.p2)?.name} pays</>
          )}
        </span>
      )}
    </div>
  )
}

// --------------------------------------------------------------- detail view

function TournamentDetail({
  tournament,
  members,
  tables,
  onBack,
  onChanged,
  onDeleted,
}: {
  tournament: Tournament
  members: Member[]
  tables: ClubTable[]
  onBack: () => void
  onChanged: (t: Tournament) => void
  onDeleted: () => void
}) {
  const { club } = useClub()
  const toast = useToast()
  const [memberId, setMemberId] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [paid, setPaid] = useState<'paid' | 'unpaid'>('paid')
  const [mode, setMode] = useState<'cash' | 'upi' | 'card'>('cash')
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editPlayer, setEditPlayer] = useState<TournamentPlayer | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const t = tournament
  const entered = new Set((t.participants ?? []).map((p) => p.memberId).filter(Boolean))
  const candidates = members.filter((m) => m.active && !entered.has(m.id))
  const canEdit = t.status !== 'completed'
  const started = t.status !== 'upcoming'

  const act = async (label: string, path: string, body?: unknown, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') => {
    if (!club) return null
    setBusy(label)
    try {
      const res = await api<Tournament>(`/clubs/${club.id}/tournaments/${t.id}${path}`, { method, body })
      onChanged(res)
      return res
    } catch (e: any) {
      toast.error(e?.message || 'Action failed')
      return null
    } finally {
      setBusy(null)
    }
  }

  const addPlayer = async () => {
    const m = members.find((x) => x.id === memberId)
    const name = m?.name ?? guestName.trim()
    const phone = m?.phone || guestPhone.trim()
    if (!name) {
      toast.error('Pick a member or type a guest name')
      return
    }
    const res = await act('add', '/participants', {
      name,
      phone: phone || null,
      memberId: memberId || null,
      paidEntry: paid === 'paid',
      mode,
    })
    if (res) {
      toast.success(`Entry added · ${name}${paid === 'paid' && res.entryFee > 0 ? ` · ${formatCurrency(res.entryFee)} collected` : ''}`)
      setMemberId('')
      setGuestName('')
      setGuestPhone('')
    }
  }

  const removePlayer = async (pid: string, name: string) => {
    const res = await act(`rm-${pid}`, `/participants/${pid}`, undefined, 'DELETE')
    if (res) toast.success(`Entry removed · ${name}`)
  }

  const markPaid = async (pid: string, name: string) => {
    const res = await act(`pay-${pid}`, `/participants/${pid}`, { paidEntry: true, mode })
    if (res) toast.success(`Entry fee collected · ${name} · ${formatCurrency(res.entryFee)}`)
  }

  const start = async () => {
    const res = await act('start', '/start')
    if (res) toast.success(isLeague ? `Round-robin fixtures ready · ${res.playerCount} players · ${res.matches.length} matches` : `Bracket ready · ${res.name}`)
  }

  const cancel = async () => {
    setConfirmCancel(false)
    const res = await act('cancel', '/cancel')
    if (res) toast.success('Tournament cancelled')
  }

  const doDelete = async () => {
    if (!club) return
    setBusy('del')
    try {
      await api(`/clubs/${club.id}/tournaments/${t.id}`, { method: 'DELETE' })
      toast.success(`Tournament deleted · ${t.name}`)
      setConfirmDel(false)
      onDeleted()
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed')
    } finally {
      setBusy(null)
    }
  }

  const rounds = groupRounds(t)
  const isLeague = (t.format ?? 'knockout') === 'league'
  const liveMatches = (t.matches ?? []).filter((m) => m.status === 'table_live').length

  // compact entries strip (shown after the bracket is made)
  const entriesStrip = (
    <Card>
      <div className="row spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="chip-row">
          {(t.participants ?? []).map((p) => (
            <span key={p.pid} className={`chip${t.winnerPid === p.pid ? ' chip-win' : ''}`} title={p.phone || 'no phone'}>
              {t.winnerPid === p.pid && <Crown size={10} />}
              {p.name}
              {!p.paidEntry && <span className="money-red small">· unpaid</span>}
            </span>
          ))}
        </div>
        <div className="row" style={{ gap: 10 }}>
          <span className="muted small">collected <b className="money-green">{formatCurrency(t.collected)}</b></span>
          {t.tableCharges > 0 && <span className="muted small">table charges <b className="money-gold">{formatCurrency(t.tableCharges)}</b></span>}
          <span className="muted small">prize pool <b>{formatCurrency(t.prize1 + t.prize2)}</b></span>
        </div>
      </div>
    </Card>
  )

  return (
    <div className="stack">
      <div className="page-head">
        <div className="row">
          <button className="btn-icon" aria-label="Back to tournaments" title="Back" onClick={onBack}>
            <ArrowLeft size={15} />
          </button>
          <div>
            <div className="section-title" style={{ margin: 0 }}>{t.name}</div>
            <p className="muted small" style={{ marginTop: 2 }}>
              {titleCase(t.game)}{isLeague ? ' · league' : ''} · {formatDate(t.date)} · entry {t.entryFee > 0 ? formatCurrency(t.entryFee) : 'free'} · {t.playerCount}/{t.maxPlayers} players
              {t.tableRate > 0 ? ` · match table ${formatCurrency(t.tableRate)}/hr` : ' · match table = club rate'}
              {liveMatches > 0 ? ` · 🔴 ${liveMatches} live` : ''}
            </p>
          </div>
        </div>
        <div className="row">
          <Badge kind={STATUS_KIND[t.status]}>{t.status}</Badge>
          {canEdit && (
            <Btn size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil size={12} /> Edit
            </Btn>
          )}
          {t.status === 'upcoming' && (
            <>
              <Btn size="sm" variant="green" loading={busy === 'start'} disabled={t.playerCount < 2} onClick={start}>
                <Play size={12} /> {isLeague ? 'Start · Make Fixtures' : 'Start · Make Bracket'}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => setConfirmCancel(true)}>
                <Ban size={12} /> Cancel
              </Btn>
            </>
          )}
          {t.status !== 'running' && (
            <Btn size="sm" variant="red" onClick={() => setConfirmDel(true)}>
              <Trash2 size={12} /> Delete
            </Btn>
          )}
        </div>
      </div>

      {t.status === 'completed' && t.winnerName && (
        <div className="champ-banner">
          <Crown size={16} />
          <span>Champion: {t.winnerName}</span>
          {t.prize1 > 0 && <Badge kind="gold">{formatCurrency(t.prize1)}</Badge>}
          {t.runnerUpName && (
            <span className="muted small">
              runner-up {t.runnerUpName}{t.prize2 > 0 ? ` · ${formatCurrency(t.prize2)}` : ''}
            </span>
          )}
          <span className="muted small" style={{ marginLeft: 'auto' }}>
            entries {formatCurrency(t.collected)}
            {t.tableCharges > 0 ? ` · table charges ${formatCurrency(t.tableCharges)}` : ''}
          </span>
        </div>
      )}

      {started && entriesStrip}

      {/* ---------------- league points table ---------------- */}
      {isLeague && started && (t.standings ?? []).length > 0 && (
        <Card>
          <div className="section-title">
            Points Table · live {t.status === 'completed' ? '· final' : ''}
          </div>
          <div className="table-scroll">
            <table className="tbl standings">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th className="num">P</th>
                  <th className="num">W</th>
                  <th className="num">L</th>
                  <th className="num">Frames +/−</th>
                  <th className="num">Pts</th>
                </tr>
              </thead>
              <tbody>
                {(t.standings ?? []).map((s, i) => (
                  <tr key={s.pid} className={i === 0 ? 'leader' : ''}>
                    <td className="num">
                      {i === 0 && (t.status === 'completed' || t.winnerPid === s.pid) ? <Crown size={12} className="money-gold" /> : `#${i + 1}`}
                    </td>
                    <td className="desc"><b>{s.name}</b></td>
                    <td className="num">{s.played}</td>
                    <td className="num money-green">{s.won}</td>
                    <td className="num muted">{s.lost}</td>
                    <td className={`num ${s.scoreDiff > 0 ? 'money-green' : s.scoreDiff < 0 ? 'money-red' : ''}`}>{s.scoreFor}/{s.scoreAgainst} · {s.scoreDiff > 0 ? '+' : ''}{s.scoreDiff}</td>
                    <td className="num"><b className="money-gold">{s.points}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Win = 3 points · ties broken by frame difference, then most wins, then name. The moment all fixtures finish, the topper becomes auto-champion.</p>
        </Card>
      )}

      <div className={started ? 'tour-detail one-col' : 'tour-detail'}>
        {/* ---------------- players (before start only) ---------------- */}
        {!started && (
          <Card>
            <div className="section-title">Players · {t.playerCount}</div>
            <div className="stack-xs" style={{ marginBottom: 8 }}>
              <div className="form-grid two">
                <Field label="Member">
                  <Select value={memberId} onChange={(e) => { setMemberId(e.target.value); setGuestName(''); setGuestPhone('') }}>
                    <option value="">Guest / type name →</option>
                    {candidates.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}{m.phone ? ` · ${m.phone}` : ''}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Guest Name">
                  <TextInput value={guestName} onChange={(e) => { setGuestName(e.target.value); setMemberId('') }} placeholder="walk-in player" disabled={!!memberId} />
                </Field>
                <Field label="Phone">
                  <TextInput inputMode="tel" value={memberId ? (candidates.find((m) => m.id === memberId)?.phone ?? '') : guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="98xxxxxx01" disabled={!!memberId} />
                </Field>
                <Field label="Entry">
                  <Select value={paid} onChange={(e) => setPaid(e.target.value as 'paid' | 'unpaid')}>
                    <option value="paid">Paid now</option>
                    <option value="unpaid">Will pay later</option>
                  </Select>
                </Field>
                <Field label="Mode">
                  <Select value={mode} onChange={(e) => setMode(e.target.value as 'cash' | 'upi' | 'card')}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </Select>
                </Field>
              </div>
              <Btn variant="green" loading={busy === 'add'} onClick={addPlayer}>
                <UserPlus size={13} /> Add Entry {t.entryFee > 0 && paid === 'paid' ? `· ${formatCurrency(t.entryFee)}` : ''}
              </Btn>
            </div>
            {(t.participants ?? []).length === 0 ? (
              <EmptyState title="No entries yet" hint={`Add members or guests — entry fees land in the revenue sheet. After adding all players, press ${isLeague ? 'Start · Make Fixtures' : 'Start · Make Bracket'}.`} />
            ) : (
              <div className="table-scroll">
                <table className="tbl">
                  <thead>
                    <tr><th>#</th><th>Player</th><th>Phone</th><th>Entry</th><th /></tr>
                  </thead>
                  <tbody>
                    {t.participants.map((p) => (
                      <tr key={p.pid}>
                        <td className="muted">{p.seed}</td>
                        <td className="desc">{p.name}</td>
                        <td className="muted nowrap">{p.phone || '—'}</td>
                        <td>
                          {p.paidEntry ? (
                            <Badge kind="green">paid</Badge>
                          ) : (
                            <button className="btn btn-sm btn-outline" onClick={() => void markPaid(p.pid, p.name)}>
                              mark paid · {formatCurrency(t.entryFee)}
                            </button>
                          )}
                        </td>
                        <td className="num nowrap">
                          <button className="btn-icon" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => setEditPlayer(p)}>
                            <Pencil size={12} />
                          </button>
                          <button className="btn-icon danger" aria-label={`Remove ${p.name}`} title="Remove" onClick={() => void removePlayer(p.pid, p.name)}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted small" style={{ marginTop: 6 }}>
              Collected {formatCurrency(t.collected)}{t.prize1 + t.prize2 > 0 ? ` · prize pool ${formatCurrency(t.prize1 + t.prize2)}` : ''}
            </p>
          </Card>
        )}

        {/* ---------------- bracket / fixtures ---------------- (hidden until players exist) */}
        {((t.participants?.length ?? 0) > 0 || started) && (
          <Card>
            <div className="section-title">
              {isLeague
                ? `League Fixtures${t.bracket > 0 ? ` · ${t.playerCount}-player round robin` : ''}`
                : `Bracket ${t.bracket > 0 ? `· ${t.bracket}-player draw` : ''}`}
            </div>
            {rounds.length === 0 ? (
              <EmptyState
                title={isLeague ? 'Fixtures not made yet' : 'Bracket not made yet'}
                hint={isLeague
                  ? 'Add all players first, then press Start · Make Fixtures — every player faces each other once.'
                  : 'Add all players first, then press Start · Make Bracket — the draw builds itself.'}
              />
            ) : (
              <div className="bracket">
                {rounds.map((matches, i) => (
                  <div className="round-col" key={i}>
                    <div className="round-title">{matches[0]?.label}</div>
                    {matches.map((m) => (
                      <MatchCard key={m.id} tournament={t} match={m} tables={tables} onDone={onChanged} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {editing && (
        <TournamentModal open tournament={t} onClose={() => setEditing(false)} onSaved={onChanged} />
      )}
      {editPlayer && (
        <PlayerEditModal tournament={t} player={editPlayer} onClose={() => setEditPlayer(null)} onSaved={onChanged} />
      )}
      <ConfirmModal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancel}
        busy={busy === 'cancel'}
        title="Cancel tournament"
        message={`Cancel "${t.name}"? Entry fees already collected stay in the ledger.`}
        confirmLabel="Cancel Tournament"
      />
      <ConfirmModal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={doDelete}
        busy={busy === 'del'}
        title="Delete tournament"
        message={`Delete "${t.name}" permanently? Results will be lost; ledger entries (fees/prizes) stay.`}
      />
    </div>
  )
}

// ================================================================= screen

export default function TournamentsScreen() {
  const { club, data } = useClub()
  const toast = useToast()
  const members = useMemo(() => data?.members ?? [], [data])
  const tables = useMemo(() => data?.tables ?? [], [data])
  const [list, setList] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!club) return
    setLoading(true)
    try {
      const rows = await api<Tournament[]>(`/clubs/${club.id}/tournaments`)
      setList(asArray<Tournament>(rows))
    } catch {
      toast.error('Could not load tournaments')
    } finally {
      setLoading(false)
    }
  }, [club?.id])

  useEffect(() => {
    void load()
  }, [load])

  // keep live timers fresh: cheap poll while a match is on a table
  const selected = list.find((t) => t.id === selectedId) ?? null
  const hasLive = !!(selected && (selected.matches ?? []).some((m) => m.status === 'table_live'))
  useEffect(() => {
    if (!hasLive) return
    const t = window.setInterval(() => void load(), 20000)
    return () => window.clearInterval(t)
  }, [hasLive, load])

  const upsert = (t: Tournament) => setList((l) => l.map((x) => (x.id === t.id ? t : x)))

  useEffect(() => {
    if (selectedId && !list.some((t) => t.id === selectedId)) setSelectedId(null)
  }, [list, selectedId])

  if (selected) {
    return (
      <TournamentDetail
        tournament={selected}
        members={members}
        tables={tables}
        onBack={() => setSelectedId(null)}
        onChanged={upsert}
        onDeleted={() => void load()}
      />
    )
  }

  const running = list.filter((t) => t.status === 'running').length
  const upcoming = list.filter((t) => t.status === 'upcoming').length
  const completed = list.filter((t) => t.status === 'completed').length
  const totalPool = list.reduce((s, t) => s + (t.collected ?? 0), 0)

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="muted small">Players &amp; entry fees → knockout bracket → match tables → champion &amp; prizes</p>
        </div>
        <Btn variant="green" onClick={() => setCreating(true)}>
          <Plus size={13} /> New Tournament
        </Btn>
      </div>

      <div className="grid-stats four">
        <StatCard label="Running" tone="green" value={running} sub="live right now" />
        <StatCard label="Upcoming" tone="gold" value={upcoming} sub="entries open" />
        <StatCard label="Completed" tone="blue" value={completed} sub="records saved" />
        <StatCard label="Entries Collected" tone="green" value={formatCurrency(totalPool)} sub="across all events" />
      </div>

      <InsightsCard scopes={['tournaments']} tournaments={list} max={4} title="Smart Insights · Events" />

      {list.length === 0 && !loading ? (
        <Card>
          <EmptyState title="No tournaments yet" hint="Create one — entry fees, knockout bracket, table timers and prizes all managed here." />
        </Card>
      ) : (
        <div className="tour-grid">
          {list.map((t) => (
            <Card key={t.id} className="tour-card" onClick={() => setSelectedId(t.id)}>
              <div className="tour-name-row">
                <span className="tour-name">{t.name}</span>
                <Badge kind={STATUS_KIND[t.status]}>{t.status}</Badge>
              </div>
              <div className="tour-meta">
                <span>{titleCase(t.game)}</span>
                {(t.format ?? 'knockout') === 'league' && <span className="money-blue">league</span>}
                <span>{formatDate(t.date)}</span>
                <span>{t.playerCount}/{t.maxPlayers} players</span>
                <span>entry {t.entryFee > 0 ? formatCurrency(t.entryFee) : 'free'}</span>
                <span className="money-green">collected {formatCurrency(t.collected)}</span>
                {t.prize1 > 0 && <span className="money-gold">prize {formatCurrency(t.prize1 + t.prize2)}</span>}
              </div>
              {t.status === 'completed' && t.winnerName && (
                <p className="small money-gold" style={{ marginTop: 6 }}>
                  <Crown size={11} style={{ verticalAlign: -1 }} /> {t.winnerName}
                  {t.runnerUpName ? ` · beat ${t.runnerUpName}` : ''}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <TournamentModal
          open
          tournament={null}
          onClose={() => setCreating(false)}
          onSaved={(t) => {
            setList((l) => [t, ...l])
            setSelectedId(t.id)
          }}
        />
      )}
    </div>
  )
}
