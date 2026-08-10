import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackagePlus, Plus, Trash2 } from 'lucide-react'
import { api, asArray } from '../lib/api'
import { useClub } from '../context/ClubContext'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDate, parseNum } from '../lib/format'
import {
  Badge,
  Btn,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  Modal,
  StatCard,
  TextInput,
} from './ui'
import InsightsCard from './InsightsCard'
import type { Expense } from '../types'

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysElapsed(month: string): number {
  const [y, m] = month.split('-').map(Number)
  const now = new Date()
  if (month === monthKey(now)) return Math.max(1, now.getDate())
  return new Date(y, m, 0).getDate() // days in that month
}

const CATEGORY_PRESETS = ['rent', 'electricity', 'salary', 'maintenance', 'stock', 'food', 'repair', 'misc']

const CAT_KIND: Record<string, 'red' | 'gold' | 'blue' | 'green' | 'muted' | 'dark'> = {
  rent: 'red',
  electricity: 'gold',
  salary: 'blue',
  stock: 'green',
  maintenance: 'muted',
}

// ----------------------------------------------------------- add modal

function ExpenseModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { club } = useClub()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('rent')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!club || !title.trim() || parseNum(amount) <= 0) return
    setBusy(true)
    try {
      await api(`/clubs/${club.id}/expenses`, {
        method: 'POST',
        body: { title: title.trim(), category: category.trim() || 'misc', amount: parseNum(amount), date, note: note.trim() || null },
      })
      toast.success(`Expense added · ${title.trim()} · ${formatCurrency(parseNum(amount))}`)
      onClose()
      onSaved()
    } catch (e: any) {
      toast.error(e?.message || 'Could not add expense')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Expense"
      width={400}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={!title.trim() || parseNum(amount) <= 0} onClick={save}>
            Save Expense
          </Btn>
        </>
      }
    >
      <div className="form-grid two">
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Title *"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rent / Electricity bill…" autoFocus /></Field>
        </div>
        <Field label="Category">
          <TextInput list="expense-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="misc" />
          <datalist id="expense-cats">
            {CATEGORY_PRESETS.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Amount *"><TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1500" /></Field>
        <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Note (optional)"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="paid to whom / what for" /></Field>
      <p className="muted small">Stock purchases? Use the Restock button on Item Billing — those expenses are recorded automatically.</p>
    </Modal>
  )
}

// ================================================================ screen

export default function ExpensesScreen() {
  const { club } = useClub()
  const toast = useToast()
  const [month, setMonth] = useState(monthKey())
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [confirmDel, setConfirmDel] = useState<Expense | null>(null)
  const [delBusy, setDelBusy] = useState(false)

  const load = useCallback(async () => {
    if (!club) return
    setLoading(true)
    setError(null)
    try {
      const rows = await api<Expense[]>(`/clubs/${club.id}/expenses?month=${month}`)
      setExpenses(asArray<Expense>(rows))
    } catch {
      setError('Could not load expenses')
    } finally {
      setLoading(false)
    }
  }, [club?.id, month])

  useEffect(() => {
    void load()
  }, [load])

  const doDelete = async () => {
    if (!club || !confirmDel) return
    setDelBusy(true)
    try {
      await api(`/clubs/${club.id}/expenses/${confirmDel.id}`, { method: 'DELETE' })
      toast.success(`Expense deleted · ${confirmDel.title}`)
      setConfirmDel(null)
      void load()
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed')
    } finally {
      setDelBusy(false)
    }
  }

  const filtered = catFilter ? expenses.filter((e) => e.category === catFilter) : expenses
  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const categories = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses])

  return (
    <div className="stack">
      <div className="page-head">
        <div className="row">
          <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value || monthKey())} aria-label="Month" />
          <Btn variant="green" onClick={() => setModal(true)}>
            <Plus size={13} /> Add Expense
          </Btn>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="grid-stats three">
        <StatCard label="Month Expenses" tone="red" value={formatCurrency(monthTotal)} sub={`${expenses.length} entries · ${month}`} />
        <StatCard
          label="Top Category"
          tone="gold"
          value={categories[0] ? categories[0][0] : '—'}
          sub={categories[0] ? formatCurrency(categories[0][1]) : 'no expenses yet'}
        />
        <StatCard
          label="Per Day (avg)"
          tone="blue"
          value={formatCurrency(monthTotal / daysElapsed(month))}
          sub="run rate this month"
        />
      </div>

      <InsightsCard month={month} scopes={['expenses', 'finance']} max={4} title="Smart Insights · Expenses" />

      {categories.length > 0 && (
        <div className="chip-row">
          <button type="button" className={`chip${catFilter === '' ? ' active' : ''}`} onClick={() => setCatFilter('')}>
            All · {formatCurrency(monthTotal)}
          </button>
          {categories.map(([cat, amt]) => (
            <button key={cat} type="button" className={`chip${catFilter === cat ? ' active' : ''}`} onClick={() => setCatFilter(catFilter === cat ? '' : cat)}>
              {cat} · {formatCurrency(amt)}
            </button>
          ))}
        </div>
      )}

      <Card>
        <div className="section-title">
          {catFilter ? `${catFilter} expenses` : 'All expenses'} · {filtered.length}
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No expenses" hint="Add rent, electricity, salary… stock purchases appear automatically when you restock items." />
        ) : (
          <div className="table-scroll">
            <table className="tbl exp-tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="exp-title">Title</th>
                  <th>Category</th>
                  <th className="exp-note">Note</th>
                  <th className="num">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap muted">{formatDate(e.date)}</td>
                    <td className="desc exp-title">
                      {e.title}
                      {e.refType === 'menu_item' && (
                        <Badge kind="green"><PackagePlus size={9} /> auto-stock</Badge>
                      )}
                    </td>
                    <td><Badge kind={CAT_KIND[e.category] ?? 'muted'}>{e.category}</Badge></td>
                    <td className="muted desc exp-note">{e.note ?? '—'}</td>
                    <td className="num money-red nowrap">{formatCurrency(e.amount)}</td>
                    <td className="num">
                      <button className="btn-icon danger" aria-label={`Delete ${e.title}`} title="Delete" onClick={() => setConfirmDel(e)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}><b>Total{catFilter ? ` (${catFilter})` : ''}</b></td>
                  <td className="num money-red"><b>{formatCurrency(total)}</b></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {modal && <ExpenseModal open onClose={() => setModal(false)} onSaved={() => void load()} />}
      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={doDelete}
        busy={delBusy}
        title="Delete expense"
        message={confirmDel ? `Delete "${confirmDel.title}" (${formatCurrency(confirmDel.amount)})?${confirmDel.refType === 'menu_item' ? ' Stock already added will stay.' : ''}` : ''}
      />
    </div>
  )
}
