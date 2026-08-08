import { useMemo, useState } from 'react'
import { Printer, Search } from 'lucide-react'
import { useClub } from '../context/ClubContext'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDateTime, modeBadge, parseNum, titleCase } from '../lib/format'
import { Badge, Btn, Card, ConfirmModal, EmptyState, Field, Modal, Seg, TextInput } from './ui'
import ReceiptModal, { itemBillReceipt, type ReceiptData } from './ReceiptModal'
import { useSearchSeed } from '../lib/useSearchSeed'
import type { ItemBill, PlanPaymentMode } from '../types'

function MarkPaidModal({ bill, onClose }: { bill: ItemBill; onClose: () => void }) {
  const { mutate } = useClub()
  const toast = useToast()
  const [amount, setAmount] = useState(String(bill.dueAmount))
  const [mode, setMode] = useState<PlanPaymentMode>('cash')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const amt = parseNum(amount)
    if (amt <= 0 || amt > bill.dueAmount) {
      toast.error(`Amount must be between 0 and ${formatCurrency(bill.dueAmount)}`)
      return
    }
    setBusy(true)
    const r = await mutate(`item-bills/${bill.id}/mark-paid`, {
      body: { amount: amt, mode },
      toast: `Item bill payment recorded · ${formatCurrency(amt)} ${mode.toUpperCase()}`,
    })
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Mark Paid · ${bill.customerName}`}
      width={360}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} onClick={submit}>Record Payment</Btn>
        </>
      }
    >
      <div className="bill-rows" style={{ marginBottom: 10 }}>
        <div className="bill-row"><span>Bill total</span><b>{formatCurrency(bill.total)}</b></div>
        <div className="bill-row"><span>Already paid</span><b>{formatCurrency(bill.paidAmount)}</b></div>
        <div className="bill-row neg"><span>Outstanding</span><b>{formatCurrency(bill.dueAmount)}</b></div>
      </div>
      <div className="form-grid">
        <Field label="Amount">
          <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Mode">
          <Seg
            value={mode}
            onChange={(v) => setMode(v as PlanPaymentMode)}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'upi', label: 'UPI' },
              { value: 'card', label: 'Card' },
            ]}
          />
        </Field>
        <p className="muted small">The payment is logged in the month it is actually received.</p>
      </div>
    </Modal>
  )
}

export default function ItemBillsScreen() {
  const { data, mutate } = useClub()
  const [search, setSearch] = useState('')
  useSearchSeed(setSearch)
  const [markPaid, setMarkPaid] = useState<ItemBill | null>(null)
  const [confirmDel, setConfirmDel] = useState<ItemBill | null>(null)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [delBusy, setDelBusy] = useState(false)

  const bills = data?.itemBills ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bills
    return bills.filter(
      (b) =>
        b.customerName.toLowerCase().includes(q) ||
        (b.memberName || '').toLowerCase().includes(q) ||
        (b.paymentMode || '').includes(q) ||
        b.items.some((i) => i.name.toLowerCase().includes(q)),
    )
  }, [bills, search])

  const doDelete = async () => {
    if (!confirmDel) return
    setDelBusy(true)
    const r = await mutate(`item-bills/${confirmDel.id}`, {
      method: 'DELETE',
      toast: 'Item bill deleted · balances reversed',
    })
    setDelBusy(false)
    if (r) setConfirmDel(null)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="muted small">Counter bill history · late payments count in their payment month</p>
        </div>
        <div className="search-box">
          <Search size={13} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer, item or mode" aria-label="Search item bills" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No item bills found" hint="Bills created on the Item Billing page appear here." />
      ) : (
        <div className="bill-grid">
          {filtered.map((b) => (
            <Card key={b.id} className="bill-card">
              <div className="bill-card-head">
                <div>
                  <div className="pc-namerow">
                    <span className="pc-name">{b.customerName}</span>
                    {b.memberName && <Badge kind="gold">{b.memberName}</Badge>}
                  </div>
                  <div className="muted small">{formatDateTime(b.createdAt)}</div>
                </div>
                <div className="row">
                  <Badge kind={b.status === 'paid' ? 'green' : b.status === 'partial' ? 'blue' : 'red'}>
                    {titleCase(b.status)}
                  </Badge>
                  <Badge kind="muted">{modeBadge(b.paymentMode)}</Badge>
                </div>
              </div>
              <div className="muted small bill-items-line">
                {b.items.map((i) => `${i.name} x${i.qty}`).join(', ')}
              </div>
              <div className="bill-rows">
                <div className="bill-row"><span>Total</span><b>{formatCurrency(b.total)}</b></div>
                <div className="bill-row"><span>Paid</span><b className="money-green">{formatCurrency(b.paidAmount)}</b></div>
                <div className={`bill-row ${b.dueAmount > 0 ? 'neg' : ''}`}><span>Due</span><b>{formatCurrency(b.dueAmount)}</b></div>
              </div>
              <div className="row">
                {b.dueAmount > 0 && (
                  <Btn size="sm" variant="green" onClick={() => setMarkPaid(b)}>Mark Paid</Btn>
                )}
                <span className="spacer" />
                <button className="btn-icon" aria-label="Print receipt" title="Print receipt" onClick={() => setReceipt(itemBillReceipt(b, data?.club.name ?? 'Club'))}>
                  <Printer size={12} />
                </button>
                <Btn size="sm" variant="ghost" className="danger-text" onClick={() => setConfirmDel(b)}>Delete</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {markPaid && <MarkPaidModal bill={markPaid} onClose={() => setMarkPaid(null)} />}
      <ReceiptModal open={!!receipt} onClose={() => setReceipt(null)} receipt={receipt} />
      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={doDelete}
        busy={delBusy}
        title="Delete item bill"
        message={confirmDel ? `Delete the ${formatCurrency(confirmDel.total)} bill for ${confirmDel.customerName}? Wallet/due balance effects will be reversed.` : ''}
      />
    </div>
  )
}
