import { useCallback, useEffect, useState } from 'react'
import { Download, Printer, TrendingDown, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
import { useClub } from '../context/ClubContext'
import { useToast } from '../context/ToastContext'
import { downloadXlsx, type SheetRow } from '../lib/xlsx'
import { formatCurrency, formatDate, formatDuration, formatHourRange, titleCase } from '../lib/format'
import { Badge, Btn, Card, EmptyState, StatCard, TextInput } from './ui'
import InsightsCard from './InsightsCard'
import PrintSheetModal, { SheetTable } from './PrintSheetModal'
import type { FinanceReport, UtilisationReport } from '../types'

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const SOURCE_ORDER: Array<[string, string]> = [
  ['frames', 'Table Billing'],
  ['items', 'Item Sales'],
  ['memberships', 'Memberships'],
  ['dueCollections', 'Due Collections'],
  ['tournaments', 'Tournament Entries'],
]

export default function FinanceScreen() {
  const { club } = useClub()
  const toast = useToast()
  const [month, setMonth] = useState(monthKey())
  const [fin, setFin] = useState<FinanceReport | null>(null)
  const [util, setUtil] = useState<UtilisationReport | null>(null)
  const [, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!club) return
    setLoading(true)
    setError(null)
    try {
      const [r, u] = await Promise.all([
        api<FinanceReport>(`/clubs/${club.id}/reports/finance?month=${month}`),
        api<UtilisationReport>(`/clubs/${club.id}/reports/utilisation?month=${month}`).catch(() => null),
      ])
      setFin(r)
      setUtil(u)
    } catch {
      setError('Could not load the finance report')
    } finally {
      setLoading(false)
    }
  }, [club?.id, month])

  useEffect(() => {
    void load()
  }, [load])

  const [xBusy, setXBusy] = useState<string | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)

  const download = async (kind: 'pnl' | 'daily' | 'stock') => {
    if (!fin) return
    setXBusy(kind)
    try {
      if (kind === 'pnl') {
        const rows: SheetRow[] = [['Section', 'Item', 'Amount'], ['INCOME', '', '']]
        for (const [key, label] of SOURCE_ORDER) rows.push(['', label, (fin.income as any)[key] ?? 0])
        rows.push(['', 'Total Income', fin.income.total])
        rows.push(['EXPENSES', '', ''])
        for (const c of fin.expenses.byCategory) rows.push(['', titleCase(c.category), c.amount])
        rows.push(['', 'Total Expenses', fin.expenses.total])
        rows.push(['', 'NET PROFIT', fin.pnl.netProfit])
        await downloadXlsx(`rowdys-den-pnl-${fin.month}.xlsx`, [{ name: 'P&L', rows }])
      } else if (kind === 'daily') {
        const rows: SheetRow[] = [['Date', 'Income', 'Expenses', 'Net', 'Running Balance']]
        for (const d of fin.daily) rows.push([d.date, d.income, d.expenses, d.net, d.balance])
        await downloadXlsx(`rowdys-den-daily-${fin.month}.xlsx`, [{ name: 'Daily Sheet', rows }])
      } else {
        const rows: SheetRow[] = [['Item', 'Category', 'Qty Sold', 'Revenue', 'Cost (COGS)', 'Profit']]
        for (const s of fin.stock.items) rows.push([s.name, s.category, s.qtySold, s.revenue, s.cogs, s.profit])
        rows.push(['TOTAL', '', fin.stock.items.reduce((s, i) => s + i.qtySold, 0), fin.stock.totalRevenue, fin.stock.totalCogs, fin.stock.totalProfit])
        await downloadXlsx(`rowdys-den-stock-profit-${fin.month}.xlsx`, [{ name: 'Stock Profit', rows }])
      }
      toast.success('Excel downloaded')
    } catch {
      toast.error('Could not generate the Excel file — refresh and try again')
    } finally {
      setXBusy(null)
    }
  }

  const profit = fin?.pnl.netProfit ?? 0
  const profitTone = profit >= 0 ? 'green' : 'red'
  const bs = fin?.balanceSheet

  return (
    <div className="stack">
      <div className="page-head">
        <div className="row">
          <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value || monthKey())} aria-label="Month" />
          <Btn variant="outline" onClick={() => setPdfOpen(true)} disabled={!fin}>
            <Printer size={13} /> PDF
          </Btn>
          <Btn variant="green" loading={xBusy === 'pnl'} disabled={!fin} onClick={() => void download('pnl')}>
            <Download size={13} /> P&L Excel
          </Btn>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {/* ---------------- KPI cards ---------------- */}
      <div className="grid-stats four">
        <StatCard label="Total Income" tone="green" value={formatCurrency(fin?.income.total ?? 0)} sub="cash received this month" />
        <StatCard label="Total Expenses" tone="red" value={formatCurrency(fin?.expenses.total ?? 0)} sub={`${fin?.expenses.rows.length ?? 0} entries`} />
        <StatCard
          label={profit >= 0 ? 'Net Profit' : 'Net Loss'}
          tone={profitTone}
          value={formatCurrency(Math.abs(profit))}
          sub={profit >= 0 ? 'income − expenses' : 'expenses exceeded income'}
        />
        <StatCard label="Stock Profit" tone="gold" value={formatCurrency(fin?.stock.totalProfit ?? 0)} sub={`sold ${fin?.stock.items.reduce((s, i) => s + i.qtySold, 0) ?? 0} pcs`} />
      </div>

      <InsightsCard month={month} finance={fin} scopes={['finance', 'expenses', 'stock', 'revenue']} max={6} />

      <div className="finance-grid">
        {/* ---------------- P&L sheet ---------------- */}
        <Card>
          <div className="section-title">Profit &amp; Loss Sheet · {fin?.month ?? month}</div>
          <div className="pnl-block">
            <div className="pnl-head"><TrendingUp size={12} /> INCOME (received)</div>
            {SOURCE_ORDER.map(([key, label]) => (
              <div className="pnl-row" key={key}>
                <span>{label}</span>
                <b className="money-green">{formatCurrency((fin?.income as any)?.[key] ?? 0)}</b>
              </div>
            ))}
            <div className="pnl-row pnl-sub">
              <span>Total Income</span>
              <b className="money-green">{formatCurrency(fin?.income.total ?? 0)}</b>
            </div>
          </div>
          <div className="pnl-block">
            <div className="pnl-head"><TrendingDown size={12} /> EXPENSES (spent)</div>
            {(fin?.expenses.byCategory ?? []).length === 0 ? (
              <p className="muted small">No expenses recorded this month.</p>
            ) : (
              (fin?.expenses.byCategory ?? []).map((c) => (
                <div className="pnl-row" key={c.category}>
                  <span>{titleCase(c.category)} <span className="muted small">×{c.count}</span></span>
                  <b className="money-red">−{formatCurrency(c.amount)}</b>
                </div>
              ))
            )}
            <div className="pnl-row pnl-sub">
              <span>Total Expenses</span>
              <b className="money-red">−{formatCurrency(fin?.expenses.total ?? 0)}</b>
            </div>
          </div>
          <div className={`pnl-row pnl-total ${profit >= 0 ? 'pos' : 'neg'}`}>
            <span>{profit >= 0 ? 'NET PROFIT' : 'NET LOSS'}</span>
            <b>{formatCurrency(Math.abs(profit))}</b>
          </div>
          <p className="muted small">Income is cash-basis (payment ledger) — same source as the monthly revenue sheet. Expenses go by their entry date.</p>
        </Card>

        {/* ---------------- Balance sheet ---------------- */}
        <Card>
          <div className="section-title">Balance Sheet · current position</div>
          <div className="pnl-block">
            <div className="pnl-head">ASSETS (club's money/goods)</div>
            <div className="pnl-row"><span>Receivables · member dues</span><b className="money-green">{formatCurrency(bs?.assets.receivables ?? 0)}</b></div>
            <div className="pnl-row"><span>Inventory value · stock in hand</span><b className="money-green">{formatCurrency(bs?.assets.inventory ?? 0)}</b></div>
          </div>
          <div className="pnl-block">
            <div className="pnl-head">LIABILITIES (club owes)</div>
            <div className="pnl-row"><span>Member wallet balances</span><b className="money-red">−{formatCurrency(bs?.liabilities.memberWallets ?? 0)}</b></div>
          </div>
          <div className={`pnl-row pnl-total ${(bs?.netPosition ?? 0) >= 0 ? 'pos' : 'neg'}`}>
            <span>NET POSITION</span>
            <b>{formatCurrency(Math.abs(bs?.netPosition ?? 0))}</b>
          </div>
          <p className="muted small">
            Net position = dues + stock value − wallet money. Cash collection = the Daily sheet's running balance.
          </p>
        </Card>
      </div>

      {/* ---------------- Table utilisation & peak hours ---------------- */}
      <Card>
        <div className="row spread">
          <div className="section-title" style={{ margin: 0 }}>Table Utilisation &amp; Peak Hours · {util?.month ?? month}</div>
          {util && util.peakHour !== null && (
            <Badge kind="gold">peak {formatHourRange(util.peakHour, util.peakHour + 1)}</Badge>
          )}
        </div>
        {!util || util.tables.length === 0 ? (
          <EmptyState title="No frames this month" hint="Once frames are billed, per-table utilisation and peak hours will show here." />
        ) : (
          <>
            <div className="table-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th className="num">Frames</th>
                    <th className="num">Time Busy</th>
                    <th className="num">Table Revenue</th>
                    <th className="num">₹/hr effective</th>
                  </tr>
                </thead>
                <tbody>
                  {util.tables.map((t) => (
                    <tr key={t.tableId}>
                      <td className="desc">{t.tableName}</td>
                      <td className="num">{t.frames}</td>
                      <td className="num">{formatDuration(t.minutes)}</td>
                      <td className="num money-green">{formatCurrency(t.revenue)}</td>
                      <td className="num muted">{t.minutes > 0 ? formatCurrency(Math.round((t.revenue / t.minutes) * 60)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><b>Total</b></td>
                    <td className="num"><b>{util.tables.reduce((s, t) => s + t.frames, 0)}</b></td>
                    <td className="num"><b>{formatDuration(util.totalMinutes)}</b></td>
                    <td className="num money-green"><b>{formatCurrency(util.totalRevenue)}</b></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {(() => {
              const topHours = [...(util.hours ?? [])].filter((h) => h.frames > 0).sort((a, b) => b.frames - a.frames).slice(0, 3)
              if (topHours.length === 0) return null
              return (
                <div className="chip-row" style={{ marginTop: 8 }}>
                  <span className="muted small">Peak hours:</span>
                  {topHours.map((h) => (
                    <span key={h.hour} className="chip">
                      {formatHourRange(h.hour, h.hour + 1)} · <b>{h.frames}</b> frames · {formatDuration(h.minutes)}
                    </span>
                  ))}
                  <span className="muted small">· set staff shifts before the peak; push membership/monthly offers in off-peak hours.</span>
                </div>
              )
            })()}
          </>
        )}
      </Card>

      {/* ---------------- Stock & item profit ---------------- */}
      <Card>
        <div className="row spread">
          <div className="section-title" style={{ margin: 0 }}>Stock Sales &amp; Profit · {fin?.month ?? month}</div>
          <Btn size="sm" loading={xBusy === 'stock'} onClick={() => void download('stock')} disabled={!fin || fin.stock.items.length === 0}>
            <Download size={12} /> Excel
          </Btn>
        </div>
        {(fin?.stock.items ?? []).length === 0 ? (
          <EmptyState title="No items sold this month" hint="Item bills made in this month will show quantity, revenue & profit here." />
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="num">Qty Sold</th>
                  <th className="num">Revenue</th>
                  <th className="num">Cost (COGS)</th>
                  <th className="num">Profit</th>
                </tr>
              </thead>
              <tbody>
                {fin?.stock.items.map((s, i) => (
                  <tr key={s.itemId ?? i}>
                    <td className="desc">{s.name}</td>
                    <td className="muted">{titleCase(s.category)}</td>
                    <td className="num">{s.qtySold}</td>
                    <td className="num money-green">{formatCurrency(s.revenue)}</td>
                    <td className="num muted">{formatCurrency(s.cogs)}</td>
                    <td className={`num ${s.profit >= 0 ? 'money-gold' : 'money-red'}`}>{formatCurrency(s.profit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}><b>Total</b></td>
                  <td className="num"><b>{fin?.stock.items.reduce((s, i) => s + i.qtySold, 0)}</b></td>
                  <td className="num money-green"><b>{formatCurrency(fin?.stock.totalRevenue ?? 0)}</b></td>
                  <td className="num muted"><b>{formatCurrency(fin?.stock.totalCogs ?? 0)}</b></td>
                  <td className="num money-gold"><b>{formatCurrency(fin?.stock.totalProfit ?? 0)}</b></td>
                </tr>
              </tfoot>
            </table>
            <p className="muted small">Accrual basis — bills created this month (paid + unpaid both). Deleted bills are excluded.</p>
          </div>
        )}
      </Card>

      {/* ---------------- Daily sheet ---------------- */}
      <Card>
        <div className="row spread">
          <div className="section-title" style={{ margin: 0 }}>Daily Sheet · cash flow</div>
          <div className="row">
            <Badge kind={profit >= 0 ? 'green' : 'red'}>
              closing {formatCurrency(fin?.daily.length ? fin.daily[fin.daily.length - 1].balance : 0)}
            </Badge>
            <Btn size="sm" loading={xBusy === 'daily'} onClick={() => void download('daily')} disabled={!fin || fin.daily.length === 0}>
              <Download size={12} /> Excel
            </Btn>
          </div>
        </div>
        {(fin?.daily ?? []).length === 0 ? (
          <EmptyState title="No activity this month" hint="Income and expense entries will build the day-by-day sheet." />
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Income</th>
                  <th className="num">Expenses</th>
                  <th className="num">Net</th>
                  <th className="num">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {fin?.daily.map((d) => (
                  <tr key={d.date}>
                    <td className="nowrap">{formatDate(d.date)}</td>
                    <td className="num money-green">{formatCurrency(d.income)}</td>
                    <td className="num money-red">{formatCurrency(d.expenses)}</td>
                    <td className={`num ${d.net >= 0 ? 'money-green' : 'money-red'}`}>{formatCurrency(d.net)}</td>
                    <td className={`num ${d.balance >= 0 ? '' : 'money-red'}`}><b>{formatCurrency(d.balance)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PrintSheetModal
        open={pdfOpen && !!fin}
        onClose={() => setPdfOpen(false)}
        title="Finance Report · PDF"
        headline={`Profit & Loss — ${fin?.month ?? month}`}
        clubName={club?.name ?? "Rowdy's Den"}
      >
        <SheetTable
          numCols={[1]}
          rows={[
            ['Income (cash received)', 'Amount'],
            ...SOURCE_ORDER.map(([key, label]) => [label, formatCurrency((fin?.income as any)?.[key] ?? 0)] as const),
            ['Total Income', formatCurrency(fin?.income.total ?? 0)],
          ]}
        />
        <div style={{ height: 10 }} />
        <SheetTable
          numCols={[1]}
          rows={[
            ['Expenses (spent)', 'Amount'],
            ...((fin?.expenses.byCategory ?? []).map((c) => [titleCase(c.category), formatCurrency(c.amount)] as const)),
            ['Total Expenses', formatCurrency(fin?.expenses.total ?? 0)],
            [`Net ${profit >= 0 ? 'Profit' : 'Loss'}`, formatCurrency(Math.abs(profit))],
          ]}
        />
        <div style={{ height: 10 }} />
        <SheetTable
          numCols={[1]}
          rows={[
            ['Balance Sheet · current', 'Amount'],
            ['Receivables (member dues)', formatCurrency(bs?.assets.receivables ?? 0)],
            ['Inventory value (stock)', formatCurrency(bs?.assets.inventory ?? 0)],
            ['Member wallets (liability)', formatCurrency(bs?.liabilities.memberWallets ?? 0)],
            ['Net Position', formatCurrency(Math.abs(bs?.netPosition ?? 0))],
          ]}
        />
      </PrintSheetModal>
    </div>
  )
}
