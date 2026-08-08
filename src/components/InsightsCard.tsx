import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  CalendarDays,
  Crown,
  PackageX,
  PartyPopper,
  Receipt,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserX,
  Wallet,
  Zap,
} from 'lucide-react'
import { api, asArray } from '../lib/api'
import { useClub } from '../context/ClubContext'
import { formatCurrency, formatDate } from '../lib/format'
import { Card } from './ui'
import type { FinanceReport, MonthlyReport, Tournament } from '../types'

/** Which family of rule-based insights this card should render. */
export type InsightScope = 'live' | 'stock' | 'finance' | 'revenue' | 'expenses' | 'members' | 'tournaments'

const ALL_SCOPES: InsightScope[] = ['live', 'stock', 'finance', 'revenue', 'expenses', 'members', 'tournaments']

type Insight = { scope: InsightScope; tone: 'green' | 'gold' | 'red' | 'blue'; icon: JSX.Element; text: JSX.Element }

interface Props {
  /** Month key `YYYY-MM` the finance/revenue insights describe. Default: current month. */
  month?: string
  /** Monthly revenue sheet (AdminScreen already loads it — passed here to skip the refetch). */
  report?: MonthlyReport | null
  /** Finance report (FinanceScreen already loads it — passed here to skip the refetch). */
  finance?: FinanceReport | null
  /** Tournaments list (TournamentsScreen already loads it — passed here to skip the refetch). */
  tournaments?: Tournament[] | null
  /** Insight families to show. Default: everything. */
  scopes?: InsightScope[]
  /** Slim variant for dense operational screens. */
  compact?: boolean
  /** Max rows (default 3 compact / 8 full). */
  max?: number
  /** Card heading override, e.g. "Smart Insights · Stock". */
  title?: string
}

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y || 1970, m || 1, 0).getDate()
}
function elapsedDays(month: string): number {
  return month === monthKey() ? Math.max(1, new Date().getDate()) : daysInMonth(month)
}

/** Rule-based smart coach for the club — turns live data into plain actions. */
export default function InsightsCard({
  month,
  report,
  finance: financeProp,
  tournaments: tournamentsProp,
  scopes,
  compact = false,
  max,
  title = 'Smart Insights',
}: Props) {
  const { club, data } = useClub()
  const monthKey_ = month ?? monthKey()
  const wanted = useMemo(() => new Set<InsightScope>(scopes ?? ALL_SCOPES), [scopes])

  // Self-fetch only the data the caller did not already hand us.
  const needMonthly = report === undefined && wanted.has('revenue')
  const needFinance = financeProp === undefined && (wanted.has('stock') || wanted.has('finance') || wanted.has('expenses'))
  const needTournaments = tournamentsProp === undefined && wanted.has('tournaments')

  const [reportSelf, setReportSelf] = useState<MonthlyReport | null>(null)
  const [financeSelf, setFinanceSelf] = useState<FinanceReport | null>(null)
  const [toursSelf, setToursSelf] = useState<Tournament[] | null>(null)

  useEffect(() => {
    if (!club || !needMonthly) return
    api<MonthlyReport>(`/clubs/${club.id}/reports/monthly?month=${monthKey_}`)
      .then(setReportSelf)
      .catch(() => setReportSelf(null))
  }, [club?.id, monthKey_, needMonthly])

  useEffect(() => {
    if (!club || !needFinance) return
    api<FinanceReport>(`/clubs/${club.id}/reports/finance?month=${monthKey_}`)
      .then(setFinanceSelf)
      .catch(() => setFinanceSelf(null))
  }, [club?.id, monthKey_, needFinance])

  useEffect(() => {
    if (!club || !needTournaments) return
    api<Tournament[]>(`/clubs/${club.id}/tournaments`)
      .then((rows) => setToursSelf(asArray<Tournament>(rows)))
      .catch(() => setToursSelf(null))
  }, [club?.id, needTournaments])

  const rep = report !== undefined ? report : reportSelf
  const fin = financeProp !== undefined ? financeProp : financeSelf
  const tours: Tournament[] = (tournamentsProp !== undefined ? tournamentsProp : toursSelf) ?? []

  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = []
    const members = data?.members ?? []
    const menu = data?.menuItems ?? []
    const sessions = data?.sessions ?? []
    const tables = data?.tables ?? []
    const stats = data?.stats
    const activeMembers = members.filter((m) => m.active !== false)

    // ---- live: tables running right now --------------------------------
    if (wanted.has('live')) {
      const live = sessions.filter((s) => !s.endedAt)
      if (live.length > 0) {
        const est = live.reduce((sum, s) => {
          const mins = Math.max(0, (Date.now() - new Date(s.startedAt).getTime()) / 60000)
          const table = Math.max(s.minCharge || 0, Math.round((mins / 60) * s.hourlyRate * 100) / 100)
          return sum + table + (s.itemsTotal ?? 0)
        }, 0)
        out.push({
          scope: 'live',
          tone: 'blue',
          icon: <Zap size={13} style={{ color: 'var(--accent-blue)' }} />,
          text: <>Abhi <b>{live.length} table{live.length > 1 ? 's' : ''} live</b> — approx <b>{formatCurrency(est)}</b> billing accumulate ho chuki hai {live.some((s) => (s.itemsTotal ?? 0) > 0) ? '(items included)' : ''}. Timers chal rahe hain.</>,
        })

        // peak-window about to end (sessions billing at peak rate)
        const peakLive = live.filter((s) => s.peak)
        if (peakLive.length > 0) {
          const first = peakLive[0]
          const tbl = tables.find((t) => t.id === first.tableId)
          out.push({
            scope: 'live',
            tone: 'gold',
            icon: <Zap size={13} className="money-gold" />,
            text: <><b>{first.tableName || 'Table'}</b> peak rate <b>{formatCurrency(first.hourlyRate)}/hr</b> pe bill ho raha hai{tbl?.rate.peakEndHour != null ? ` — window ${String(tbl.rate.peakEndHour).padStart(2, '0')}:00 khatam; uske baad wale players normal rate pe jayenge` : ' — rush hour billing on hai'}.</>,
          })
        }

        // long session, no advance yet — gentle collect-early nudge
        const noAdvance = live.find(
          (s) => !(s.advancePaid ?? 0) && Date.now() - new Date(s.startedAt).getTime() > 45 * 60000,
        )
        if (noAdvance) {
          out.push({
            scope: 'live',
            tone: 'gold',
            icon: <Wallet size={13} className="money-gold" />,
            text: <><b>{noAdvance.tableName || 'Table'}</b> 45+ min se bina advance ke chal rahi hai — card ke <b>Advance</b> button pe thoda paisa le lo, safe side.</>,
          })
        }
      }

      // stopped sessions waiting for final-bill confirm
      const stuck = sessions.filter((s) => s.endedAt)
      if (stuck.length > 0) {
        out.push({
          scope: 'live',
          tone: 'red',
          icon: <UserX size={13} className="money-red" />,
          text: <><b>{stuck.length} table Final Bill pe atki</b> hai{stuck.length > 1 ? 'in' : 'n'} — winner mark karke confirm karo, table phir free hogi.</>,
        })
      }
    }

    // ---- stock -----------------------------------------------------------
    if (wanted.has('stock')) {
      const zero = menu.filter((m) => m.active !== false && (m.stockQty ?? 0) <= 0)
      if (zero.length > 0) {
        out.push({
          scope: 'stock',
          tone: 'red',
          icon: <PackageX size={13} className="money-red" />,
          text: <>Out of stock — <b>{zero.slice(0, 4).map((m) => m.name).join(', ')}{zero.length > 4 ? ` +${zero.length - 4}` : ''}</b> abhi counter pe band padi hai. Restock button se maal aate hi dobara khul jayegi.</>,
        })
      }
      const low = menu.filter((m) => m.active !== false && (m.stockQty ?? 0) > 0 && m.stockQty <= (m.reorderLevel ?? 5))
      if (low.length > 0) {
        out.push({
          scope: 'stock',
          tone: 'red',
          icon: <PackageX size={13} className="money-red" />,
          text: <>Low stock (reorder level ke neeche) — <b>{low.map((m) => `${m.name} (${m.stockQty})`).join(', ')}</b>. Restock karo warna counter pe sale ruk jayegi.</>,
        })
      }
      const soldIds = new Set((fin?.stock.items ?? []).map((i) => i.itemId).filter(Boolean))
      const dead = menu.filter((m) => m.active !== false && m.stockQty >= 10 && !soldIds.has(m.id))
      if (fin && dead.length > 0) {
        out.push({
          scope: 'stock',
          tone: 'gold',
          icon: <Boxes size={13} className="money-gold" />,
          text: <>Dead stock — <b>{dead.slice(0, 4).map((m) => m.name).join(', ')}{dead.length > 4 ? ` +${dead.length - 4}` : ''}</b> ka maal pda hai par is mahine 0 pcs bika. Combo offers ya price check karo.</>,
        })
      }
      const top = fin?.stock.items?.length ? [...fin.stock.items].sort((a, b) => b.profit - a.profit)[0] : null
      if (top && top.profit > 0) {
        out.push({
          scope: 'stock',
          tone: 'green',
          icon: <TrendingUp size={13} className="money-green" />,
          text: <>Sabse profitable item is month: <b>{top.name}</b> — {formatCurrency(top.profit)} profit ({top.qtySold} pcs). Stock kabhi khatam mat hone do.</>,
        })
      }
    }

    // ---- finance -----------------------------------------------------------
    if (wanted.has('finance') && fin) {
      const net = fin.pnl.netProfit
      out.push({
        scope: 'finance',
        tone: net >= 0 ? 'green' : 'gold',
        icon: net >= 0 ? <PartyPopper size={13} className="money-green" /> : <TrendingDown size={13} className="money-gold" />,
        text: net >= 0
          ? <>Month abhi tak <b>{formatCurrency(net)} profit</b> me hai — solid chal raha hai. Expenses {formatCurrency(fin.pnl.expenseTotal)} vs income {formatCurrency(fin.pnl.incomeTotal)}.</>
          : <>Mahina abhi tak <b>{formatCurrency(Math.abs(net))} down</b> hai — kharch aage chal rahe hain. Table occupancy aur counter sales pe focus karo; stock profit abhi {formatCurrency(fin.stock.totalProfit)} hai.</>,
      })

      // balance-sheet health: dues coming in vs prepaid liability
      const bs = fin.balanceSheet
      if ((bs.assets.receivables ?? 0) > 0 || (bs.liabilities.memberWallets ?? 0) > 0) {
        const recv = bs.assets.receivables ?? 0
        const wallets = bs.liabilities.memberWallets ?? 0
        out.push({
          scope: 'finance',
          tone: recv >= wallets ? 'blue' : 'gold',
          icon: recv >= wallets
            ? <Wallet size={13} style={{ color: 'var(--accent-blue)' }} />
            : <Wallet size={13} className="money-gold" />, 
          text: <>Position ka chhota x-ray — members se <b>{formatCurrency(recv)}</b> aana hai, wallets me <b>{formatCurrency(wallets)}</b> lautana hai. Net position {formatCurrency(Math.abs(bs.netPosition))}{recv < wallets ? ' — jyada wallet bechna matlab zyada liability, bill pe due thoda kam push karo' : ''}.</>,
        })
      }

      // counter side-business strength
      if (fin.income.total > 0 && fin.stock.totalRevenue > 0) {
        const share = Math.round((fin.stock.totalRevenue / fin.income.total) * 100)
        if (share >= 25) {
          out.push({
            scope: 'finance',
            tone: 'green',
            icon: <TrendingUp size={13} className="money-green" />,
            text: <>Counter items income ka <b>{share}%</b> deti hain ({formatCurrency(fin.stock.totalRevenue)}, profit {formatCurrency(fin.stock.totalProfit)}) — yeh club ki achhi side-kasai hai, top sellers ka stock kabhi zero mat hone do.</>,
          })
        }
      }
    }

    // ---- expenses -----------------------------------------------------------
    if (wanted.has('expenses') && fin && fin.expenses.total > 0) {
      const topCat = [...fin.expenses.byCategory].sort((a, b) => b.amount - a.amount)[0]
      if (topCat) {
        const share = Math.round((topCat.amount / fin.expenses.total) * 100)
        out.push({
          scope: 'expenses',
          tone: share >= 50 ? 'red' : 'gold',
          icon: <Receipt size={13} className={share >= 50 ? 'money-red' : 'money-gold'} />,
          text: <>Sabse bada kharch: <b>{topCat.category}</b> — {formatCurrency(topCat.amount)} ({share}% of month expenses){share >= 50 ? ' — is pe laagam zaroori hai' : ''}.</>,
        })
      }
      const proj = (fin.expenses.total / elapsedDays(monthKey_)) * daysInMonth(monthKey_)
      if (fin.income.total > 0 && proj > fin.income.total * 1.2) {
        out.push({
          scope: 'expenses',
          tone: 'red',
          icon: <TrendingDown size={13} className="money-red" />,
          text: <>Kharch run-rate ~<b>{formatCurrency(proj)}/month</b> aa raha hai — abhi ki income {formatCurrency(fin.income.total)} ke muqable kafi zyada. Month close hone se pehle sales badhao ya kharch roko.</>,
        })
      }
    }

    // ---- revenue -----------------------------------------------------------
    if (wanted.has('revenue') && rep && rep.daily.length > 0) {
      const best = [...rep.daily].sort((a, b) => b.total - a.total)[0]
      if (best.total > 0) {
        out.push({
          scope: 'revenue',
          tone: 'blue',
          icon: <CalendarDays size={13} style={{ color: 'var(--accent-blue)' }} />,
          text: <>Best din ab tak: <b>{formatDate(best.date)}</b> — {formatCurrency(best.total)} collection. Us din kya hua tha, wahi repeat karo.</>,
        })
      }

      // today vs this month's average earning day
      if (monthKey_ === monthKey()) {
        const today = new Date().toISOString().slice(0, 10)
        const todayRow = rep.daily.find((d) => d.date === today)
        const days = rep.daily.length || 1
        const avg = rep.daily.reduce((s, d) => s + d.total, 0) / days
        const todayTotal = todayRow?.total ?? 0
        if (avg >= 1 && days >= 3 && new Date().getHours() >= 15) {
          if (todayTotal < avg * 0.6) {
            out.push({
              scope: 'revenue',
              tone: 'red',
              icon: <TrendingDown size={13} className="money-red" />,
              text: <>Aaj ka collection <b>{formatCurrency(todayTotal)}</b> — month-average {formatCurrency(Math.round(avg))} se kafi peeche. Tables khali hain to walk-in offers ya membership push karo.</>,
            })
          } else if (todayTotal > avg * 1.3) {
            out.push({
              scope: 'revenue',
              tone: 'green',
              icon: <TrendingUp size={13} className="money-green" />,
              text: <>Aaj <b>{formatCurrency(todayTotal)}</b> — average {formatCurrency(Math.round(avg))} se upar zama raha hai 🔥 Stock cross-check karo, peak me na khatam ho jaye.</>,
            })
          }
        }
      }
    }

    // ---- members -----------------------------------------------------------
    if (wanted.has('members')) {
      const dueMembers = activeMembers.filter((m) => (m.dueAmount ?? 0) > 0).sort((a, b) => b.dueAmount - a.dueAmount)
      const limit = stats?.dueLimit ?? 0
      const totalDue = stats?.totalDue ?? 0
      if (dueMembers.length > 0) {
        const worst = dueMembers[0]
        const nearLimit = limit > 0 && totalDue >= limit * 0.7
        out.push({
          scope: 'members',
          tone: nearLimit ? 'red' : 'gold',
          icon: <UserX size={13} className={nearLimit ? 'money-red' : 'money-gold'} />,
          text: <>Due trackers — {dueMembers.length} member{dueMembers.length === 1 ? '' : 's'} pe {formatCurrency(totalDue)} baaki{nearLimit ? ` (limit ${formatCurrency(limit)} ke paas!)` : ''}. Sabse zyada: <b>{worst.name}</b> · {formatCurrency(worst.dueAmount)} — Due Desk se collection maango.</>,
        })
      }

      const days = (iso: string) => (new Date(iso).getTime() - Date.now()) / 86400000
      const expiring = activeMembers.filter((m) => m.planType === 'monthly' && m.planExpiresAt && days(m.planExpiresAt) <= 7)
      if (expiring.length > 0) {
        const overdue = expiring.filter((m) => days(m.planExpiresAt!) < 0).length
        out.push({
          scope: 'members',
          tone: 'gold',
          icon: <Crown size={13} className="money-gold" />,
          text: <>{expiring.length} monthly membership{expiring.length > 1 ? 's' : ''} {overdue > 0 ? `${overdue} to expire bhi ho chuki hai — ` : ''}7 din ke andar khatam ho rahi hain (<b>{expiring.slice(0, 3).map((m) => m.name).join(', ')}</b>{expiring.length > 3 ? '…' : ''}). Renewals yaad dilva do.</>,
        })
      }

      const plain = activeMembers.filter((m) => !m.planId)
      if (activeMembers.length >= 3 && plain.length / activeMembers.length > 0.5) {
        out.push({
          scope: 'members',
          tone: 'gold',
          icon: <Target size={13} className="money-gold" />,
          text: <>{plain.length}/{activeMembers.length} players bina membership ke hain — <b>Wallet/Frame Pass</b> bechne se advance cash milega aur players locked rahenge.</>,
        })
      }

      // due concentration — a few wallets hold most of the club's risk
      if (dueMembers.length >= 3 && totalDue > 0) {
        const top3 = dueMembers.slice(0, 3).reduce((s, m) => s + m.dueAmount, 0)
        const share = Math.round((top3 / totalDue) * 100)
        if (share >= 60) {
          out.push({
            scope: 'members',
            tone: 'gold',
            icon: <Target size={13} className="money-gold" />,
            text: <>Due ka <b>{share}%</b> sirf top-3 me atka hai (<b>{dueMembers.slice(0, 3).map((m) => m.name).join(', ')}</b>) — in se WhatsApp Remind bhejo, baaki percentage dekho to asaan lagega.</>,
          })
        }
      }

      const walletTotal = activeMembers.reduce((s, m) => s + Math.max(0, m.walletBalance ?? 0), 0)
      if (walletTotal > 0) {
        out.push({
          scope: 'members',
          tone: 'blue',
          icon: <Wallet size={13} style={{ color: 'var(--accent-blue)' }} />,
          text: <>Members ke wallets me <b>{formatCurrency(walletTotal)}</b> prepaid pda hai — ye club ki liability hai; balance sheet me counted.</>,
        })
      }
    }

    // ---- tournaments -----------------------------------------------------------
    if (wanted.has('tournaments') && tours.length > 0) {
      const unpaidEvt = tours
        .filter((t) => t.status === 'upcoming')
        .map((t) => ({ t, cnt: t.participants.filter((p) => !p.paidEntry).length }))
        .filter((x) => x.cnt > 0 && x.t.entryFee > 0)
      for (const { t, cnt } of unpaidEvt.slice(0, 2)) {
        out.push({
          scope: 'tournaments',
          tone: 'gold',
          icon: <Trophy size={13} className="money-gold" />,
          text: <>Entry fees pending — <b>{t.name}</b> ({formatDate(t.date)}): {cnt} player{cnt > 1 ? 's' : ''} ne abhi nahi diya · <b>{formatCurrency(cnt * t.entryFee)}</b> baaki. Start se pehle collect kar lo.</>,
        })
      }
      for (const t of tours.filter((x) => x.status === 'running').slice(0, 1)) {
        const played = t.matches.filter((m) => m.status === 'played').length
        const onTable = t.matches.filter((m) => m.status === 'table_live').length
        if ((t.format ?? 'knockout') === 'league') {
          const leader = (t.standings ?? [])[0]
          const done = t.matches.filter((m) => m.status !== 'pending').length
          out.push({
            scope: 'tournaments',
            tone: 'blue',
            icon: <Trophy size={13} style={{ color: 'var(--accent-blue)' }} />,
            text: <>League chal rahi hai — <b>{t.name}</b>: {done}/{t.matches.length} fixtures khel chuke{leader ? `, abhi <b>${leader.name}</b> top pe (${leader.points} pts)` : ''}. Sab fixtures khatam hote hi topper auto-champion.</>,
          })
        } else {
          out.push({
            scope: 'tournaments',
            tone: 'blue',
            icon: <Trophy size={13} style={{ color: 'var(--accent-blue)' }} />,
            text: <>Bracket live — <b>{t.name}</b>: {played} match khel chuke{onTable > 0 ? `, ${onTable} abhi table pe` : ''}. Table charges ab tak {formatCurrency(t.tableCharges ?? 0)}.</>,
          })
        }
      }
      const done = tours
        .filter((t) => t.status === 'completed')
        .sort((a, b) => String(b.completedAt ?? b.date).localeCompare(String(a.completedAt ?? a.date)))[0]
      if (done) {
        const net = (done.collected ?? 0) + (done.tableCharges ?? 0) - (done.prize1 ?? 0) - (done.prize2 ?? 0)
        out.push({
          scope: 'tournaments',
          tone: net >= 0 ? 'green' : 'gold',
          icon: net >= 0 ? <PartyPopper size={13} className="money-green" /> : <Trophy size={13} className="money-gold" />,
          text: <>Last event <b>{done.name}</b> — champion {done.winnerName ?? '—'}. Entries {formatCurrency(done.collected ?? 0)} + table {formatCurrency(done.tableCharges ?? 0)} − prizes {formatCurrency((done.prize1 ?? 0) + (done.prize2 ?? 0))} ⇒ club ke haath <b>{formatCurrency(net)}</b>.</>,
        })
      }
    }

    // Critical first — compact strips show red/gold alerts before good news.
    const rank = { red: 0, gold: 1, blue: 2, green: 3 } as const
    return [...out].sort((a, b) => rank[a.tone] - rank[b.tone])
  }, [wanted, rep, fin, tours, data, monthKey_])

  const limit = max ?? (compact ? 3 : 8)
  const visible = insights.slice(0, limit)
  if (!visible.length) return null

  return (
    <Card className={`insights${compact ? ' compact' : ''}`}>
      <div className="row spread">
        <div className="section-title" style={{ margin: 0 }}>
          <Sparkles size={13} className="money-gold" style={{ verticalAlign: -2 }} /> {title}
        </div>
        <span className="live-badge">
          <span className="live-dot" /> LIVE
        </span>
      </div>
      <div className="stack-xs" style={{ marginTop: 6 }}>
        {visible.map((ins, i) => (
          <div key={i} className={`insight-row insight-${ins.tone}`}>
            <span className="ic">{ins.icon}</span>
            <span>{ins.text}</span>
          </div>
        ))}
      </div>
      {insights.length > visible.length && (
        <p className="muted small" style={{ marginTop: 4 }}>+{insights.length - visible.length} aur insights — Reports / Finance pe pura breakdown.</p>
      )}
    </Card>
  )
}
