import { useCallback, useEffect, useState } from 'react'
import { Printer, TrendingDown, TrendingUp, Wallet2 } from 'lucide-react'
import { api } from '../lib/api'
import { useClub } from '../context/ClubContext'
import { formatCurrency, formatNumber, titleCase } from '../lib/format'
import { Badge, Btn, Card, StatCard, TextInput } from './ui'
import PrintSheetModal, { SheetTable } from './PrintSheetModal'
import InsightsCard from './InsightsCard'
import type { DayCloseReport } from '../types'

function todayKey(): string {
  // local date (counter closes its own day, not UTC's)
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const MODE_ORDER: Array<[string, string]> = [
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['card', 'Card'],
  ['wallet', 'Wallet'],
  ['mixed', 'Mixed'],
  ['due', 'Due'],
]

const SOURCE_ORDER: Array<[string, string, keyof DayCloseReport['counts']]> = [
  ['frames', 'Table Billing (frames)', 'frames'],
  ['items', 'Item Sales', 'itemBills'],
  ['memberships', 'Memberships', 'memberships'],
  ['dueCollections', 'Due Collections', 'duePayments'],
  ['tournaments', 'Tournament Entries', 'tournaments'],
]

export default function DayCloseScreen() {
  const { club } = useClub()
  const [date, setDate] = useState(todayKey())
  const [rep, setRep] = useState<DayCloseReport | null>(null)
  const [, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)

  const load = useCallback(async () => {
    if (!club) return
    setLoading(true)
    setError(null)
    try {
      setRep(await api<DayCloseReport>(`/clubs/${club.id}/reports/day-close?date=${date}`))
    } catch (e: any) {
      setError(e?.message || 'Could not load the day-close report')
    } finally {
      setLoading(false)
    }
  }, [club?.id, date])

  useEffect(() => {
    void load()
  }, [load])

  const net = rep?.net ?? 0
  const modeRows = MODE_ORDER.filter(([k]) => (rep?.byMode?.[k] ?? 0) > 0)
  const isToday = date === todayKey()

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="muted small">One click for the whole day’s account — match the cash drawer, catch mistakes</p>
        </div>
        <div className="row">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value || todayKey())} aria-label="Date" />
          <Btn variant="outline" onClick={() => setPdfOpen(true)} disabled={!rep}>
            <Printer size={13} /> Print / PDF
          </Btn>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <InsightsCard compact scopes={['finance', 'expenses', 'stock', 'revenue', 'members']} max={4} title="Smart Insights · Today" />

      {/* ---------------- headline numbers ---------------- */}
      <div className="grid-stats four">
        <StatCard label="Total Collected" tone="green" value={formatCurrency(rep?.collected ?? 0)} sub={`${rep?.counts.payments ?? 0} payment entries`} />
        <StatCard label="Expenses" tone="red" value={formatCurrency(rep?.expenses.total ?? 0)} sub={`${rep?.expenses.count ?? 0} entries this day`} />
        <StatCard
          label={net >= 0 ? 'Net in hand' : 'Net (loss)'}
          tone={net >= 0 ? 'blue' : 'red'}
          value={formatCurrency(Math.abs(net))}
          sub="collected − expenses · this should be in the drawer"
        />
        <StatCard label="Pending Due (all members)" tone="gold" value={formatCurrency(rep?.totalDueNow ?? 0)} sub="all members · right now" />
      </div>

      <div className="finance-grid">
        {/* ---------------- mode split ---------------- */}
        <Card>
          <div className="section-title">Mode-wise Collection · {rep?.date}</div>
          {modeRows.length === 0 ? (
            <p className="muted small">No collections recorded today.</p>
          ) : (
            <div className="pnl-block">
              {modeRows.map(([k, label]) => (
                <div className="pnl-row" key={k}>
                  <span>{label}</span>
                  <b className="money-green">{formatCurrency(rep?.byMode?.[k] ?? 0)}</b>
                </div>
              ))}
              <div className="pnl-row pnl-sub">
                <span>Total</span>
                <b className="money-green">{formatCurrency(rep?.collected ?? 0)}</b>
              </div>
            </div>
          )}
          {((rep?.byMode?.wallet ?? 0) + (rep?.byMode?.due ?? 0)) === 0 && (rep?.collected ?? 0) > 0 && (
            <p className="muted small">Wallet/due payments carry no ledger mode — the split above covers cash-hand collections only.</p>
          )}
          <div className="pnl-block">
            <div className="pnl-head">SOURCE-WISE (which stream earned)</div>
            {SOURCE_ORDER.map(([key, label, ck]) => (
              <div className="pnl-row" key={key}>
                <span>{label} <span className="muted small">×{rep?.counts?.[ck] ?? 0}</span></span>
                <b className={(rep?.bySource?.[key] ?? 0) > 0 ? 'money-green' : 'muted'}>{formatCurrency(rep?.bySource?.[key] ?? 0)}</b>
              </div>
            ))}
          </div>
        </Card>

        {/* ---------------- expenses + ops snapshot ---------------- */}
        <Card>
          <div className="section-title">Today’s Expenses</div>
          {(rep?.expenses.byCategory ?? []).length === 0 ? (
            <p className="muted small">No expenses booked on this date.</p>
          ) : (
            <div className="pnl-block">
              {rep!.expenses.byCategory.map((c) => (
                <div className="pnl-row" key={c.category}>
                  <span>{titleCase(c.category)}</span>
                  <b className="money-red">−{formatCurrency(c.amount)}</b>
                </div>
              ))}
              <div className="pnl-row pnl-sub">
                <span>Total expenses</span>
                <b className="money-red">−{formatCurrency(rep?.expenses.total ?? 0)}</b>
              </div>
            </div>
          )}
          <div className="pnl-block">
            <div className="pnl-head">OPS SNAPSHOT</div>
            <div className="pnl-row">
              <span>Frames billed</span>
              <b>{rep?.frames.count ?? 0} · {formatCurrency((rep?.frames.tableAmount ?? 0) + (rep?.frames.itemsAmount ?? 0))}</b>
            </div>
            <div className="pnl-row">
              <span>Table amount</span>
              <b className="money-green">{formatCurrency(rep?.frames.tableAmount ?? 0)}</b>
            </div>
            <div className="pnl-row">
              <span>Items on frames</span>
              <b className="money-gold">{formatCurrency(rep?.frames.itemsAmount ?? 0)}</b>
            </div>
            <div className="pnl-row">
              <span>Tables live right now</span>
              <b className="money-blue">{rep?.liveSessions ?? 0}</b>
            </div>
          </div>
        </Card>
      </div>

      {/* ---------------- top items ---------------- */}
      <Card>
        <div className="section-title">Top 5 Counter Items · today</div>
        {(rep?.topItems ?? []).length === 0 ? (
          <p className="muted small">No item bills were made today.</p>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Revenue</th>
                  <th className="num">Profit</th>
                </tr>
              </thead>
              <tbody>
                {rep!.topItems.map((i) => (
                  <tr key={i.name}>
                    <td className="desc">{i.name}</td>
                    <td className="num">{formatNumber(i.qty)}</td>
                    <td className="num money-green">{formatCurrency(i.revenue)}</td>
                    <td className={`num ${i.profit >= 0 ? 'money-gold' : 'money-red'}`}>{formatCurrency(i.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ---------------- closing line ---------------- */}
      <Card className={`dayclose-line ${net >= 0 ? 'pos' : 'neg'}`}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {net >= 0 ? <TrendingUp size={16} className="money-green" /> : <TrendingDown size={16} className="money-red" />}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="section-title" style={{ margin: 0 }}>
              Closing · {isToday ? 'today so far' : rep?.date} — the drawer should hold <b className={net >= 0 ? 'money-green' : 'money-red'}>{formatCurrency(net)}</b>
            </div>
            <p className="muted small" style={{ marginTop: 2 }}>
              Count the cash in the drawer: {formatCurrency((rep?.byMode?.cash ?? 0) - (rep?.expenses.total ?? 0))} (cash collected {formatCurrency(rep?.byMode?.cash ?? 0)} − expenses {formatCurrency(rep?.expenses.total ?? 0)}). UPI/card {formatCurrency((rep?.byMode?.upi ?? 0) + (rep?.byMode?.card ?? 0))} should match your statements.
            </p>
          </div>
          <div className="dc-side">
            <Badge kind={net >= 0 ? 'green' : 'red'}>
              <Wallet2 size={10} style={{ verticalAlign: -1 }} /> {net >= 0 ? 'drawer healthy' : 'drawer short'}
            </Badge>
            <Btn size="sm" variant="outline" onClick={() => setDate(todayKey())} disabled={isToday}>
              Back to Today
            </Btn>
          </div>
        </div>
      </Card>

      <PrintSheetModal
        open={pdfOpen && !!rep}
        onClose={() => setPdfOpen(false)}
        title="Day Close · Print"
        headline={`Day Close — ${rep?.date ?? date}`}
        clubName={rep?.clubName ?? club?.name ?? "Rowdy's Den"}
      >
        <SheetTable
          numCols={[1]}
          rows={[
            ['Collections (mode-wise)', 'Amount'],
            ...MODE_ORDER.filter(([k]) => (rep?.byMode?.[k] ?? 0) > 0).map(([k, l]) => [l, formatCurrency(rep?.byMode?.[k] ?? 0)] as const),
            ['Total Collected', formatCurrency(rep?.collected ?? 0)],
          ]}
        />
        <div style={{ height: 10 }} />
        <SheetTable
          numCols={[1]}
          rows={[
            ['Source-wise', 'Amount'],
            ['Table billing (frames)', formatCurrency(rep?.bySource?.frames ?? 0)],
            ['Item sales', formatCurrency(rep?.bySource?.items ?? 0)],
            ['Memberships', formatCurrency(rep?.bySource?.memberships ?? 0)],
            ['Due collections', formatCurrency(rep?.bySource?.dueCollections ?? 0)],
            ['Tournament entries', formatCurrency(rep?.bySource?.tournaments ?? 0)],
          ]}
        />
        <div style={{ height: 10 }} />
        <SheetTable
          numCols={[1]}
          rows={[
            ['Expenses', 'Amount'],
            ...((rep?.expenses.byCategory ?? []).map((c) => [titleCase(c.category), formatCurrency(c.amount)] as const)),
            ...(rep?.expenses.byCategory.length ? [] : [['No expenses', '—'] as const]),
            ['Total expenses', formatCurrency(rep?.expenses.total ?? 0)],
            ['NET IN HAND (drawer)', formatCurrency(rep?.net ?? 0)],
          ]}
        />
        {(rep?.topItems ?? []).length > 0 && (
          <>
            <div style={{ height: 10 }} />
            <SheetTable
              numCols={[1, 2, 3]}
              rows={[
                ['Top counter items', 'Qty', 'Revenue', 'Profit'],
                ...(rep!.topItems.map((i) => [i.name, String(i.qty), formatCurrency(i.revenue), formatCurrency(i.profit)] as const)),
              ]}
            />
          </>
        )}
        <p className="sh-sub" style={{ marginTop: 8 }}>
          Frames billed: {rep?.frames.count ?? 0} · Table {formatCurrency(rep?.frames.tableAmount ?? 0)} · Items {formatCurrency(rep?.frames.itemsAmount ?? 0)} ·
          Total pending due (all members): {formatCurrency(rep?.totalDueNow ?? 0)}
        </p>
      </PrintSheetModal>
    </div>
  )
}
