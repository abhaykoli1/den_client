import { useCallback, useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { api } from '../lib/api'
import { useClub } from '../context/ClubContext'
import { useToast } from '../context/ToastContext'
import { downloadXlsx, type SheetRow } from '../lib/xlsx'
import { formatCurrency, formatDateTime } from '../lib/format'
import { Badge, Btn, Card, EmptyState, StatCard, TextInput } from './ui'
import InsightsCard from './InsightsCard'
import PrintSheetModal, { SheetTable } from './PrintSheetModal'
import type { MembershipPlan, MonthlyReport } from '../types'

const PLAN_CLASS: Record<string, string> = {
  wallet: 'plan-tag plan-wallet',
  pass: 'plan-tag plan-pass',
  monthly: 'plan-tag plan-monthly',
}

/** Render a transaction description; color the plan name for membership rows. */
function Description({ source, label, plans }: { source: string; label: string; plans: MembershipPlan[] }) {
  if (source !== 'Membership') return <>{label}</>
  const parts = label.split(' · ')
  if (parts.length < 3) return <>{label}</>
  const planSegment = parts[1]
  const plan = plans.find((p) => p.name.toLowerCase() === planSegment.toLowerCase())
  const cls = PLAN_CLASS[plan?.type ?? ''] ?? 'plan-tag plan-wallet'
  return <>{parts[0]} · <b className={cls}>{planSegment}</b> · {parts.slice(2).join(' · ')}</>
}

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AdminScreen() {
  const { club, data } = useClub()
  const plans = data?.plans ?? []
  const toast = useToast()
  const [month, setMonth] = useState(monthKey())
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [xBusy, setXBusy] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)

  const load = useCallback(async () => {
    if (!club) return
    setLoading(true)
    setError(null)
    try {
      const r = await api<MonthlyReport>(`/clubs/${club.id}/reports/monthly?month=${month}`)
      setReport(r)
    } catch {
      setError('Could not load the monthly report')
    } finally {
      setLoading(false)
    }
  }, [club?.id, month])

  useEffect(() => {
    void load()
  }, [load])

  const download = async () => {
    if (!report) return
    setXBusy(true)
    try {
      const rows: SheetRow[] = [['Date', 'Source', 'Description', 'Mode', 'Amount']]
      for (const r of report.rows) rows.push([formatDateTime(r.createdAt), r.source, r.label, r.mode, r.amount])
      rows.push(['Month Total', '', '', '', report.totalEarnings])
      const daily: SheetRow[] = [['Date', 'Frames', 'Items', 'Memberships', 'Due Collections', 'Tournaments', 'Total']]
      for (const d of report.daily ?? []) daily.push([d.date, d.frames, d.items, d.memberships, d.dueCollections, d.tournaments ?? 0, d.total])
      await downloadXlsx(`rowdys-den-revenue-${report.month}.xlsx`, [
        { name: 'Transactions', rows },
        { name: 'Per-day Totals', rows: daily },
      ])
      toast.success('Monthly report Excel downloaded')
    } catch {
      toast.error('Could not generate the Excel file — refresh and try again')
    } finally {
      setXBusy(false)
    }
  }

  const st = report?.sourceTotals
  const empty = report ? report.rows.length === 0 : false

  return (
    <div className="stack">
      <div className="page-head">
        <div className="row">
          <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value || monthKey())} aria-label="Month" />
          <Btn variant="outline" onClick={() => setPdfOpen(true)} disabled={!report}>
            <Printer size={13} /> PDF
          </Btn>
          <Btn variant="green" loading={xBusy} onClick={() => void download()} disabled={!report || empty}>
            <Download size={13} /> Excel
          </Btn>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="grid-stats six">
        <StatCard label="Frame Billing" tone="green" value={formatCurrency(st?.frames ?? 0)} sub={`${report?.counts.frames ?? 0} payments`} />
        <StatCard label="Item Billing" tone="blue" value={formatCurrency(st?.items ?? 0)} sub={`${report?.counts.itemBills ?? 0} payments`} />
        <StatCard label="Memberships" tone="gold" value={formatCurrency(st?.memberships ?? 0)} sub={`${report?.counts.memberships ?? 0} plans sold`} />
        <StatCard label="Due Collected" tone="red" value={formatCurrency(st?.dueCollections ?? 0)} sub={`${report?.counts.duePayments ?? 0} payments`} />
        <StatCard label="Tournaments" tone="blue" value={formatCurrency(st?.tournaments ?? 0)} sub={`${report?.counts.tournaments ?? 0} entry fees`} />
        <StatCard label="Month Total" tone="green" value={formatCurrency(report?.totalEarnings ?? 0)} sub={report?.month ?? month} />
      </div>

      {/* Smart Insights reads the books ABOVE the raw transaction list */}
      <InsightsCard month={month} report={report} />

      <Card>
        <div className="section-title">Transactions</div>
        {empty ? (
          <EmptyState title="No earnings this month" hint="Frame payments, item bills, plan sales and due collections will appear here." />
        ) : (
          <div className="table-scroll">
            <table className="tbl tx-tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Description</th>
                  <th>Mode</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(report?.rows ?? []).map((r, i) => (
                  <tr key={i}>
                    <td className="nowrap">{formatDateTime(r.createdAt)}</td>
                    <td>
                      <Badge kind={r.source === 'Frame' ? 'blue' : r.source === 'Item Bill' ? 'green' : r.source === 'Membership' ? 'gold' : r.source === 'Tournament' ? 'dark' : 'red'}>
                        {r.source}
                      </Badge>
                    </td>
                    <td className="desc"><Description source={r.source} label={r.label} plans={plans} /></td>
                    <td className="nowrap">{r.mode}</td>
                    <td className="num nowrap">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(report?.daily?.length ?? 0) > 0 && (
        <Card>
          <div className="section-title">Per-day totals</div>
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Frames</th>
                  <th className="num">Items</th>
                  <th className="num">Memberships</th>
                  <th className="num">Due</th>
                  <th className="num">Tournaments</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {report!.daily.map((d) => (
                  <tr key={d.date}>
                    <td className="nowrap">{d.date}</td>
                    <td className="num">{formatCurrency(d.frames)}</td>
                    <td className="num">{formatCurrency(d.items)}</td>
                    <td className="num">{formatCurrency(d.memberships)}</td>
                    <td className="num">{formatCurrency(d.dueCollections)}</td>
                    <td className="num">{formatCurrency(d.tournaments ?? 0)}</td>
                    <td className="num"><b>{formatCurrency(d.total)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <PrintSheetModal
        open={pdfOpen && !!report}
        onClose={() => setPdfOpen(false)}
        title="Monthly Revenue · PDF"
        headline={`Monthly Revenue — ${report?.month ?? month}`}
        sub=""
        clubName={club?.name ?? "Rowdy's Den"}
      >
        <SheetTable
          numCols={[1, 2, 3, 4, 5, 6]}
          rows={[
            ['Source', 'Frames', 'Items', 'Memberships', 'Due Collections', 'Tournaments', 'Total'],
            [
              'This month',
              formatCurrency(st?.frames ?? 0),
              formatCurrency(st?.items ?? 0),
              formatCurrency(st?.memberships ?? 0),
              formatCurrency(st?.dueCollections ?? 0),
              formatCurrency(st?.tournaments ?? 0),
              formatCurrency(report?.totalEarnings ?? 0),
            ],
          ]}
        />
        <div style={{ height: 10 }} />
        <SheetTable
          numCols={[2, 4]}
          rows={[
            ['Date', 'Source', 'Description', 'Mode', 'Amount'],
            ...((report?.rows ?? []).map((r) => [formatDateTime(r.createdAt), r.source, r.label, r.mode, formatCurrency(r.amount)] as const)),
            ['Month Total', '', '', '', formatCurrency(report?.totalEarnings ?? 0)],
          ]}
        />
      </PrintSheetModal>
    </div>
  )
}
