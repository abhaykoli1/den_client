// Thermal-printer friendly receipt (58mm) — preview in a modal, real print
// via window.print(): a portal copy lives at <body>.print-root and the
// @media print CSS swaps the whole app for the receipt only.
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { formatCurrency, formatDateTime, formatDuration, modeBadge, titleCase } from '../lib/format'
import { Btn, Modal } from './ui'
import type { FrameRecord, ItemBill } from '../types'

export interface ReceiptLineItem {
  name: string
  qty: number
  amount: string
}

export interface ReceiptRow {
  label: string
  value: string
  strong?: boolean
  neg?: boolean
}

export interface ReceiptData {
  kind: string // 'TABLE BILL' | 'ITEM BILL'
  clubName: string
  billNo: string
  when: string
  party: string
  partyNote?: string | null
  items?: ReceiptLineItem[]
  rows: ReceiptRow[]
  total: string
  paid: string
  due?: string | null
  mode: string
  footer?: string
}

export function frameReceipt(f: FrameRecord, clubName: string): ReceiptData {
  const rows: ReceiptRow[] = [
    { label: `Table · ${formatDuration(f.durationMinutes)}`, value: formatCurrency(f.tableAmount) },
  ]
  if (f.itemsAmount > 0) rows.push({ label: 'Items', value: formatCurrency(f.itemsAmount) })
  if ((f.gloveCharges ?? 0) > 0) {
    const names = (f.gloves ?? []).filter((g) => !g.returned).map((g) => g.label).join(', ')
    rows.push({ label: `Gloves not returned${names ? ` · ${names}` : ''}`, value: `+${formatCurrency(f.gloveCharges)}` })
  }
  if (f.winnerBonus > 0) rows.push({ label: 'Winner bonus', value: `+${formatCurrency(f.winnerBonus)}` })
  if (f.membershipDiscount > 0) rows.push({ label: `Premium ${f.membershipDiscountPercent}%`, value: `-${formatCurrency(f.membershipDiscount)}`, neg: true })
  if (f.passTableCredit > 0) rows.push({ label: `Pass · ${f.passMemberName}`, value: `-${formatCurrency(f.passTableCredit)}`, neg: true })
  if ((f.oldDueAmount ?? 0) > 0) rows.push({ label: 'Old due included', value: formatCurrency(f.oldDueAmount) })
  if (f.discount > 0) rows.push({ label: 'Discount', value: `-${formatCurrency(f.discount)}`, neg: true })
  if ((f.advancePaid ?? 0) > 0) rows.push({ label: 'Advance (already received)', value: formatCurrency(f.advancePaid) })
  return {
    kind: 'TABLE BILL',
    clubName,
    billNo: f.id.slice(0, 8).toUpperCase(),
    when: formatDateTime(f.endedAt ?? f.createdAt),
    party: f.tableName,
    partyNote:
      `Winner: ${(f.winners ?? []).join(', ') || '—'} · Pays: ${(f.losers ?? []).join(', ') || '—'}` +
      (f.matchMode === '2v2' && f.winningTeam ? ` · Team ${f.winningTeam} won` : ''),
    items: (f.items ?? []).map((i) => ({ name: i.name, qty: i.qty, amount: formatCurrency(i.amount) })),
    rows,
    total: formatCurrency(f.totalAmount),
    paid: formatCurrency(f.paidAmount),
    due: f.dueAmount > 0 ? formatCurrency(f.dueAmount) : null,
    mode: modeBadge(f.paymentMode),
    footer: f.status === 'paid' ? 'Payment complete — thank you!' : titleCase(f.status),
  }
}

export function itemBillReceipt(b: ItemBill, clubName: string): ReceiptData {
  const rows: ReceiptRow[] = [
    { label: 'Subtotal', value: formatCurrency(b.subtotal) },
  ]
  if (b.discount > 0) rows.push({ label: 'Discount', value: `-${formatCurrency(b.discount)}`, neg: true })
  if ((b.walletPart ?? 0) > 0) rows.push({ label: 'Wallet used', value: formatCurrency(b.walletPart) })
  return {
    kind: 'ITEM BILL',
    clubName,
    billNo: b.id.slice(0, 8).toUpperCase(),
    when: formatDateTime(b.createdAt),
    party: b.customerName,
    partyNote: b.memberName ? `Member: ${b.memberName}` : null,
    items: (b.items ?? []).map((i) => ({ name: i.name, qty: i.qty, amount: formatCurrency(i.amount) })),
    rows,
    total: formatCurrency(b.total),
    paid: formatCurrency(b.paidAmount),
    due: b.dueAmount > 0 ? formatCurrency(b.dueAmount) : null,
    mode: modeBadge(b.paymentMode),
    footer: b.status === 'paid' ? 'Payment complete — thank you!' : titleCase(b.status),
  }
}

function ReceiptPaper({ data }: { data: ReceiptData }) {
  return (
    <div className="receipt">
      <div className="r-center r-brand">{data.clubName}</div>
      <div className="r-center r-sub">powered by Rowdy&apos;s Den — Club Billing</div>
      <div className="r-dash" />
      <div className="r-row"><span>{data.kind}</span><span>#{data.billNo}</span></div>
      <div className="r-row"><span>{data.when}</span><span>{data.party}</span></div>
      {data.partyNote && <div className="r-note">{data.partyNote}</div>}
      <div className="r-dash" />
      {(data.items ?? []).length > 0 && (
        <>
          {data.items!.map((i, idx) => (
            <div className="r-row" key={idx}>
              <span className="r-ellipsis">{i.name} x{i.qty}</span>
              <span>{i.amount}</span>
            </div>
          ))}
          <div className="r-dash" />
        </>
      )}
      {data.rows.map((r, idx) => (
        <div className={`r-row${r.strong ? ' r-strong' : ''}`} key={idx}>
          <span>{r.label}</span>
          <span>{r.value}</span>
        </div>
      ))}
      <div className="r-dash" />
      <div className="r-row r-strong r-big"><span>TOTAL</span><span>{data.total}</span></div>
      <div className="r-row"><span>Paid ({data.mode})</span><span>{data.paid}</span></div>
      {data.due && <div className="r-row r-strong"><span>DUE LEFT</span><span>{data.due}</span></div>}
      <div className="r-dash" />
      <div className="r-center r-sub">{data.footer ?? 'Thank you!'}</div>
      <div className="r-center r-sub">Visit again · play fair</div>
    </div>
  )
}

export default function ReceiptModal({
  open,
  onClose,
  receipt,
}: {
  open: boolean
  onClose: () => void
  receipt: ReceiptData | null
}) {
  const doPrint = () => {
    document.body.classList.add('do-print')
    const cleanup = () => document.body.classList.remove('do-print')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
    window.setTimeout(cleanup, 2500) // safety if afterprint never fires
  }

  return (
    <>
      <Modal
        open={open && !!receipt}
        onClose={onClose}
        title="Print Receipt"
        width={340}
        footer={
          <>
            <Btn variant="ghost" onClick={onClose}>Close</Btn>
            <Btn variant="green" onClick={doPrint}>
              <Printer size={13} /> Print (58mm)
            </Btn>
          </>
        }
      >
        {receipt && (
          <div className="receipt-preview">
            <ReceiptPaper data={receipt} />
          </div>
        )}
        <p className="muted small center" style={{ marginTop: 6 }}>
          Works on both thermal (58mm) and regular A4 printers.
        </p>
      </Modal>
      {open && receipt && createPortal(
        <div className="print-root" aria-hidden>
          <ReceiptPaper data={receipt} />
        </div>,
        document.body,
      )}
    </>
  )
}
