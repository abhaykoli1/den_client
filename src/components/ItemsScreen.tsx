import { useMemo, useState } from 'react'
import { PackagePlus, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClub } from '../context/ClubContext'
import { useToast } from '../context/ToastContext'
import { formatCurrency, parseNum, titleCase } from '../lib/format'
import {
  Badge,
  Btn,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  Modal,
  Select,
  TextInput,
} from './ui'
import InsightsCard from './InsightsCard'
import ReceiptModal, { itemBillReceipt, type ReceiptData } from './ReceiptModal'
import type { ItemBill, MenuItem, PaymentMode } from '../types'

// ----------------------------------------------------------- item modal

function ItemModal({ open, onClose, item }: { open: boolean; onClose: () => void; item: MenuItem | null }) {
  const { mutate } = useClub()
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? 'Cafe')
  const [price, setPrice] = useState(String(item?.price ?? ''))
  const [costPrice, setCostPrice] = useState(String(item?.costPrice ?? '0'))
  const [stockQty, setStockQty] = useState(String(item?.stockQty ?? '0'))
  const [reorderLevel, setReorderLevel] = useState(String(item?.reorderLevel ?? '5'))
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [active, setActive] = useState(item?.active ?? true)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    const body: Record<string, unknown> = {
      name: name.trim(),
      category: category.trim() || 'General',
      price: parseNum(price),
      costPrice: parseNum(costPrice),
      reorderLevel: Math.max(0, Math.floor(parseNum(reorderLevel, 5))),
      unit: unit.trim() || null,
      active,
    }
    if (!item) body.stockQty = Math.max(0, Math.floor(parseNum(stockQty)))
    const r = item
      ? await mutate(`menu-items/${item.id}`, { method: 'PATCH', body, toast: 'Menu item updated' })
      : await mutate('menu-items', { body, toast: 'Menu item added' })
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? `Edit · ${item.name}` : 'Add Menu Item'}
      width={420}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={!name.trim()} onClick={save}>
            {item ? 'Save Item' : 'Add Item'}
          </Btn>
        </>
      }
    >
      <div className="form-grid two">
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Category"><TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Cafe / Snacks / Drinks" /></Field>
        <Field label="Selling Price"><TextInput inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="40" /></Field>
        <Field label="Purchase ₹/piece" hint="cost — used for profit tracking">
          <TextInput inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="15" />
        </Field>
        <Field label="Unit"><TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="cup / plate (optional)" /></Field>
        <Field label="Reorder level" hint="is se neeche = low-stock alert">
          <TextInput inputMode="numeric" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} placeholder="5" />
        </Field>
        {!item && (
          <Field label="Opening Stock" hint="re-stock later anytime">
            <TextInput inputMode="numeric" value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
          </Field>
        )}
      </div>
      <label className="check-row">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>Active (shown on billing chips)</span>
      </label>
      {item && <p className="muted small">Stock qty changes via the Restock button so every purchase is recorded as an expense.</p>}
    </Modal>
  )
}

// ----------------------------------------------------------- restock modal

function RestockModal({ open, onClose, item }: { open: boolean; onClose: () => void; item: MenuItem }) {
  const { mutate } = useClub()
  const [qty, setQty] = useState('')
  const [unitCost, setUnitCost] = useState(String(item.costPrice || ''))
  const [busy, setBusy] = useState(false)

  const qtyNum = Math.max(0, Math.floor(parseNum(qty)))
  const costNum = parseNum(unitCost)
  const total = qtyNum * costNum

  const save = async () => {
    if (qtyNum <= 0) return
    setBusy(true)
    const r = await mutate(`menu-items/${item.id}/restock`, {
      body: { qty: qtyNum, unitCost: costNum },
      toast: `Stock added · ${item.name} +${qtyNum} pcs · expense ${formatCurrency(total)}`,
    })
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Restock · ${item.name}`}
      width={380}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={qtyNum <= 0} onClick={save}>Add Stock</Btn>
        </>
      }
    >
      <p className="muted small">Current stock: <b>{item.stockQty} pcs</b> · cost {formatCurrency(item.costPrice)}/pc</p>
      <div className="form-grid two">
        <Field label="Quantity (pcs)"><TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="50" autoFocus /></Field>
        <Field label="Purchase ₹/piece"><TextInput inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="15" /></Field>
      </div>
      <p className="small money-gold">Purchase total {formatCurrency(total)} — auto-recorded as a Stock expense this month.</p>
    </Modal>
  )
}

// ================================================================ screen

export default function ItemsScreen() {
  const { data, mutate } = useClub()
  const toast = useToast()
  const navigate = useNavigate()
  const menuItems = useMemo(() => data?.menuItems ?? [], [data])
  const members = data?.members ?? []

  const [itemModal, setItemModal] = useState<{ item: MenuItem | null } | null>(null)
  const [confirmDel, setConfirmDel] = useState<MenuItem | null>(null)
  const [restock, setRestock] = useState<MenuItem | null>(null)
  const [delBusy, setDelBusy] = useState(false)

  // New item bill state
  const [qty, setQty] = useState<Record<string, number>>({})
  const [customer, setCustomer] = useState('')
  const [memberId, setMemberId] = useState('')
  const [discount, setDiscount] = useState('0')
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [paid, setPaid] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  const activeItems = menuItems.filter((m) => m.active)
  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>()
    for (const item of menuItems) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return [...map.entries()]
  }, [menuItems])

  const member = members.find((m) => m.id === memberId) ?? null
  const selected = activeItems.filter((m) => (qty[m.id] ?? 0) > 0)
  const subtotal = selected.reduce((s, m) => s + (qty[m.id] ?? 0) * m.price, 0)
  const discountNum = Math.min(parseNum(discount), subtotal)
  const total = Math.max(0, subtotal - discountNum)

  const walletCover = mode === 'wallet' && member ? Math.min(member.walletBalance, total) : 0
  const paidNum = mode === 'due' || mode === 'wallet' ? walletCover : paid === null ? total : Math.min(parseNum(paid), total)
  const dueLeft = Math.max(0, total - (mode === 'due' ? 0 : paidNum))
  const estProfit = selected.reduce((s, m) => s + (qty[m.id] ?? 0) * Math.max(0, m.price - m.costPrice), 0) - discountNum

  const bump = (id: string, delta: number) =>
    setQty((q) => {
      const item = menuItems.find((m) => m.id === id)
      const cap = item ? Math.max(0, item.stockQty) : Number.POSITIVE_INFINITY
      return { ...q, [id]: Math.min(cap, Math.max(0, (q[id] ?? 0) + delta)) }
    })

  const createBill = async () => {
    if (!customer.trim()) {
      toast.error('Customer name is required')
      return
    }
    if (selected.length === 0) {
      toast.error('Add at least one item')
      return
    }
    if ((mode === 'wallet' || mode === 'due') && !member) {
      toast.error('Select a member for wallet/due bills')
      return
    }
    setBusy(true)
    const r = await mutate('item-bills', {
      body: {
        customerName: customer.trim(),
        memberId: memberId || null,
        items: selected.map((m) => ({ itemId: m.id, qty: qty[m.id] })),
        discount: discountNum,
        paymentMode: mode,
        paidAmount: mode === 'due' || mode === 'wallet' ? 0 : paidNum,
        notes: notes || null,
      },
      toast: `Item bill created · ${customer.trim()} · ${formatCurrency(total)}`,
    })
    setBusy(false)
    if (r) {
      setReceipt(itemBillReceipt(r as ItemBill, data?.club.name ?? 'Club'))
      setQty({})
      setCustomer('')
      setDiscount('0')
      setPaid(null)
      setNotes('')
    }
  }

  const doDeleteItem = async () => {
    if (!confirmDel) return
    setDelBusy(true)
    const r = await mutate(`menu-items/${confirmDel.id}`, { method: 'DELETE', toast: `Menu item deleted · ${confirmDel.name}` })
    setDelBusy(false)
    if (r) setConfirmDel(null)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="muted small">Counter sales — cafe, snacks &amp; misc items</p>
        </div>
        <div className="row">
          <button className="btn-icon" aria-label="All Item Bills" title="All Item Bills" onClick={() => navigate('/item-bills')}>
            <Receipt size={15} />
          </button>
          <Btn variant="green" onClick={() => setItemModal({ item: null })}>
            <Plus size={13} /> Add Menu Item
          </Btn>
        </div>
      </div>

      <InsightsCard scopes={['stock']} max={4} title="Smart Insights · Stock" />

      <div className="items-layout">
        {/* ---------- New Item Bill ---------- */}
        <Card className="new-bill">
          <div className="section-title">New Item Bill</div>
          {activeItems.length === 0 ? (
            <EmptyState title="No menu items" hint="Add items to start billing." />
          ) : (
            <div className="chip-row item-chips">
              {activeItems.map((m) => {
                const out = m.stockQty <= 0
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`item-chip${(qty[m.id] ?? 0) > 0 ? ' has-qty' : ''}${out ? ' out-of-stock' : ''}`}
                    disabled={out}
                    title={out ? 'Out of stock — restock from the menu list' : `${m.stockQty} in stock`}
                    onClick={() => bump(m.id, 1)}
                  >
                    <Plus size={10} />
                    <span className="item-chip-name">{m.name}</span>
                    <span className="money-gold">{formatCurrency(m.price)}</span>
                    <span className={`stock-pill${out ? ' zero' : m.stockQty <= (m.reorderLevel ?? 5) ? ' low' : ''}`} title={`Low-stock alert at ≤${m.reorderLevel ?? 5}`}>{m.stockQty}</span>
                    {(qty[m.id] ?? 0) > 0 && <span className="qty-badge">{qty[m.id]}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {selected.length > 0 && (
            <div className="sel-items">
              {selected.map((m) => (
                <div className="sel-item" key={m.id}>
                  <span className="sel-item-name">{m.name}</span>
                  <span className="qty-ctl">
                    <button aria-label="Decrease" onClick={() => bump(m.id, -1)}>-</button>
                    <b>{qty[m.id]}</b>
                    <button aria-label="Increase" onClick={() => bump(m.id, 1)}>+</button>
                  </span>
                  <span className="money-gold small">{formatCurrency((qty[m.id] ?? 0) * m.price)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="form-grid two">
            <Field label="Customer Name *">
              <TextInput value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in customer" />
            </Field>
            <Field label="Member (optional — enables wallet/due)">
              <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">Guest / no member</option>
                {members.filter((m) => m.active).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Discount">
              <TextInput inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
            <Field label="Payment Mode">
              <Select value={mode} onChange={(e) => { setMode(e.target.value as PaymentMode); setPaid(null) }}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="wallet">Wallet (member)</option>
                <option value="due">Due (member)</option>
                <option value="mixed">Mixed</option>
              </Select>
            </Field>
            <Field label={mode === 'due' ? 'Paid (locked)' : 'Paid'}>
              <TextInput
                inputMode="decimal"
                value={mode === 'due' ? '0' : paid === null ? String(mode === 'wallet' ? walletCover : total) : paid}
                disabled={mode === 'due' || mode === 'wallet'}
                onChange={(e) => setPaid(e.target.value)}
              />
            </Field>
            <Field label="Notes">
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
            </Field>
          </div>

          {mode === 'wallet' && member && (
            <p className="small money-gold">
              Wallet covers {formatCurrency(walletCover)} of {formatCurrency(total)}
              {total > walletCover ? ` · rest ${formatCurrency(total - walletCover)} goes to due` : ''}
            </p>
          )}

          <div className="bill-rows">
            <div className="bill-row"><span>Subtotal</span><b>{formatCurrency(subtotal)}</b></div>
            {discountNum > 0 && <div className="bill-row neg"><span>Discount</span><b>-{formatCurrency(discountNum)}</b></div>}
            <div className="bill-row total"><span>Total</span><b>{formatCurrency(total)}</b></div>
            <div className={`bill-row ${dueLeft > 0 ? 'neg' : 'pos'}`}><span>Due / unpaid</span><b>{formatCurrency(mode === 'due' ? total : dueLeft)}</b></div>
            {estProfit > 0 && <div className="bill-row pos"><span>Est. profit (sell - cost)</span><b>{formatCurrency(estProfit)}</b></div>}
          </div>

          <Btn variant="green" className="btn-block" loading={busy} onClick={createBill}>
            Create Bill {total > 0 ? `· ${formatCurrency(total)}` : ''}
          </Btn>
        </Card>

        {/* ---------- Menu management ---------- */}
        <div className="stack-sm">
          <div className="section-title">Menu · {menuItems.length} items</div>
          {grouped.length === 0 && <EmptyState title="No menu items yet" hint="Add tea, cold drinks, snacks…" />}
          {grouped.map(([cat, items]) => (
            <Card key={cat} className="menu-group">
              <div className="menu-cat">{titleCase(cat)}</div>
              <div className="menu-list">
                {items.map((m) => (
                  <div key={m.id} className={`menu-row${m.active ? '' : ' inactive'}`}>
                    <span className="menu-name">
                      {m.name}
                      {m.unit && <span className="muted small"> · {m.unit}</span>}
                      {!m.active && <Badge kind="muted">inactive</Badge>}
                      <span className={`stock-pill${m.stockQty <= 0 ? ' zero' : m.stockQty <= (m.reorderLevel ?? 5) ? ' low' : ''}`} title={`Cost ${formatCurrency(m.costPrice)}/pc · alert at ≤${m.reorderLevel ?? 5}`}>
                        {m.stockQty} pcs
                      </span>
                    </span>
                    <span className="menu-price">
                      <span className="money-gold">{formatCurrency(m.price)}</span>
                      <span className="muted small">cost {formatCurrency(m.costPrice)}</span>
                    </span>
                    <button className="btn-icon" aria-label={`Restock ${m.name}`} title="Restock (adds expense)" onClick={() => setRestock(m)}>
                      <PackagePlus size={12} />
                    </button>
                    <button className="btn-icon" aria-label={`Edit ${m.name}`} title="Edit" onClick={() => setItemModal({ item: m })}>
                      <Pencil size={12} />
                    </button>
                    <button className="btn-icon danger" aria-label={`Delete ${m.name}`} title="Delete" onClick={() => setConfirmDel(m)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {itemModal && <ItemModal open onClose={() => setItemModal(null)} item={itemModal.item} />}
      {restock && <RestockModal open onClose={() => setRestock(null)} item={restock} />}
      <ReceiptModal open={!!receipt} onClose={() => setReceipt(null)} receipt={receipt} />
      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={doDeleteItem}
        busy={delBusy}
        title="Delete menu item"
        message={confirmDel ? `Delete ${confirmDel.name} from the menu? Past bills are not affected.` : ''}
      />
    </div>
  )
}
