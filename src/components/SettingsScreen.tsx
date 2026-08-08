import { useRef, useState } from 'react'
import { Download, FileJson, ImagePlus, Pencil, Plus, Power, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClub } from '../context/ClubContext'
import { useToast } from '../context/ToastContext'
import { dateStamp, downloadJson } from '../lib/csv'
import { downloadXlsx, xlsxName, type SheetDef, type SheetRow } from '../lib/xlsx'
import { formatCurrency, formatDateTime, formatHourRange, parseNum, titleCase } from '../lib/format'
import {
  Badge,
  Btn,
  Card,
  ConfirmModal,
  Field,
  Modal,
  Select,
  TextInput,
} from './ui'
import type { ClubTable, MembershipPlan, PlanType } from '../types'

// ------------------------------------------------------------- table modal

function TableModal({ onClose, table }: { onClose: () => void; table: ClubTable | null }) {
  const { mutate } = useClub()
  const toast = useToast()
  const rate = table?.rate
  const [name, setName] = useState(table?.name ?? '')
  const [hourly, setHourly] = useState(String(rate?.hourlyRate ?? ''))
  const [p2, setP2] = useState(String(rate?.ratesByPlayers?.['2'] ?? ''))
  const [p3, setP3] = useState(String(rate?.ratesByPlayers?.['3'] ?? ''))
  const [p4, setP4] = useState(String(rate?.ratesByPlayers?.['4'] ?? ''))
  const [minCharge, setMinCharge] = useState(String(rate?.minCharge ?? 20))
  const [sortOrder, setSortOrder] = useState(String(table?.sortOrder ?? 0))
  const [peakRate, setPeakRate] = useState(rate?.peakHourlyRate ? String(rate.peakHourlyRate) : '')
  const [peakFrom, setPeakFrom] = useState(rate?.peakStartHour != null ? String(rate.peakStartHour) : '18')
  const [peakTo, setPeakTo] = useState(rate?.peakEndHour != null ? String(rate.peakEndHour) : '23')
  const [glove, setGlove] = useState(rate?.glovePrice ? String(rate.glovePrice) : '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    const peak = parseNum(peakRate)
    const fromH = Math.trunc(parseNum(peakFrom, -1))
    const toH = Math.trunc(parseNum(peakTo, -1))
    if (peak > 0 && (!(fromH >= 0 && fromH <= 23) || !(toH >= 0 && toH <= 23))) {
      toast.error('Enter peak hours between 0–23 (e.g. 18 to 23)')
      return
    }
    if (peak > 0 && fromH === toH) {
      toast.error('Peak start and end hour cannot be the same')
      return
    }
    setBusy(true)
    const ratesByPlayers: Record<string, number> = {}
    for (const [k, v] of [['2', p2], ['3', p3], ['4', p4]] as const) {
      const n = parseNum(v)
      if (n > 0) ratesByPlayers[k] = n
    }
    const body = {
      name: name.trim(),
      hourlyRate: parseNum(hourly),
      ratesByPlayers,
      minCharge: parseNum(minCharge),
      sortOrder: Math.trunc(parseNum(sortOrder)),
      active: table?.active ?? true,
    }
    const gloveAmt = parseNum(glove)
    const r = table
      ? await mutate(`tables/${table.id}`, {
          method: 'PATCH',
          body: {
            ...body,
            peakHourlyRate: peak > 0 ? peak : null,
            peakStartHour: peak > 0 ? fromH : null,
            peakEndHour: peak > 0 ? toH : null,
            glovePrice: gloveAmt,
          },
          toast:
            peak > 0
              ? `Table updated · peak ${formatCurrency(peak)}/hr ${formatHourRange(fromH, toH)}`
              : 'Table updated',
        })
      : await mutate('tables', {
          body: {
            ...body,
            glovePrice: gloveAmt,
            ...(peak > 0 ? { peakHourlyRate: peak, peakStartHour: fromH, peakEndHour: toH } : {}),
          },
          toast: 'Table added',
        })
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={table ? `Edit · ${table.name}` : 'Add Table'}
      width={460}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={!name.trim()} onClick={save}>{table ? 'Save Table' : 'Add Table'}</Btn>
        </>
      }
    >
      <div className="form-grid two">
        <Field label="Table name"><TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Snooker" /></Field>
        <Field label="Default hourly rate"><TextInput inputMode="decimal" value={hourly} onChange={(e) => setHourly(e.target.value)} placeholder="240" /></Field>
        <Field label="2P rate (optional)"><TextInput inputMode="decimal" value={p2} onChange={(e) => setP2(e.target.value)} placeholder="blank = default" /></Field>
        <Field label="3P rate (optional)"><TextInput inputMode="decimal" value={p3} onChange={(e) => setP3(e.target.value)} /></Field>
        <Field label="4P rate (optional)"><TextInput inputMode="decimal" value={p4} onChange={(e) => setP4(e.target.value)} /></Field>
        <Field label="Minimum charge"><TextInput inputMode="decimal" value={minCharge} onChange={(e) => setMinCharge(e.target.value)} /></Field>
        <Field label="Sort order"><TextInput inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></Field>
        <Field label="Peak ₹/hr (blank = off)" hint="evening rush rate">
          <TextInput inputMode="decimal" value={peakRate} onChange={(e) => setPeakRate(e.target.value)} placeholder="e.g. 350" />
        </Field>
        <Field label="Peak window (hour 0–23)" hint="start–end, e.g. 18 to 23">
          <div className="row">
            <TextInput inputMode="numeric" value={peakFrom} onChange={(e) => setPeakFrom(e.target.value)} aria-label="Peak start hour" />
            <span className="muted small">to</span>
            <TextInput inputMode="numeric" value={peakTo} onChange={(e) => setPeakTo(e.target.value)} aria-label="Peak end hour" />
          </div>
        </Field>
        <Field label="Glove price ₹/piece (blank = off)" hint="added to the frame bill if the glove is not returned">
          <TextInput inputMode="decimal" value={glove} onChange={(e) => setGlove(e.target.value)} placeholder="e.g. 30" />
        </Field>
      </div>
      {peakRate && parseNum(peakRate) > 0 && (
        <p className="muted small">
          During the peak window the table runs {parseNum(peakTo) < parseNum(peakFrom) ? '(crossing midnight) ' : ''}at 
          <b className="money-gold">{formatCurrency(parseNum(peakRate))}/hr</b> (per-player rates paused). Normal rate applies otherwise.
        </p>
      )}
    </Modal>
  )
}

// -------------------------------------------------------------- plan modal

function PlanModal({ onClose, plan }: { onClose: () => void; plan: MembershipPlan | null }) {
  const { mutate } = useClub()
  const [name, setName] = useState(plan?.name ?? '')
  const [type, setType] = useState<PlanType>(plan?.type ?? 'wallet')
  const [amount, setAmount] = useState(String(plan?.amount ?? ''))
  const [value, setValue] = useState(String(plan?.value ?? ''))
  const [days, setDays] = useState(String(plan?.days ?? 30))
  const [pct, setPct] = useState(String(plan?.tableDiscountPercent ?? ''))
  const [isDefault, setIsDefault] = useState(plan?.isDefault ?? false)
  const [active, setActive] = useState(plan?.active ?? true)
  const [description, setDescription] = useState(plan?.description ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    const body = {
      name: name.trim(),
      type,
      amount: parseNum(amount),
      value: type === 'monthly' ? 0 : parseNum(value),
      days: Math.trunc(parseNum(days)),
      tableDiscountPercent: type === 'monthly' ? parseNum(pct) : 0,
      isDefault,
      active,
      description: description || null,
    }
    const r = plan
      ? await mutate(`plans/${plan.id}`, { method: 'PATCH', body, toast: 'Membership plan updated' })
      : await mutate('plans', { body, toast: 'Membership plan added' })
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? `Edit · ${plan.name}` : 'Add Membership Plan'}
      width={480}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="green" loading={busy} disabled={!name.trim()} onClick={save}>{plan ? 'Save Plan' : 'Add Plan'}</Btn>
        </>
      }
    >
      <p className="muted small">Wallet = prepaid credit · Pass = frame pack · Monthly = premium table % discount</p>
      <div className="form-grid two">
        <Field label="Plan name"><TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Gold Wallet" /></Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as PlanType)}>
            <option value="wallet">Wallet</option>
            <option value="pass">Pass</option>
            <option value="monthly">Monthly</option>
          </Select>
        </Field>
        <Field label="Amount paid (₹)"><TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" /></Field>
        {type === 'wallet' && <Field label="Wallet credit (₹)"><TextInput inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="600" /></Field>}
        {type === 'pass' && <Field label="Number of frames"><TextInput inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="10" /></Field>}
        {type === 'monthly' && <Field label="Table discount %"><TextInput inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="5" /></Field>}
        <Field label="Validity (days, 0 = no expiry)"><TextInput inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        <Field label="Description"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" /></Field>
      </div>
      <div className="row" style={{ gap: 16 }}>
        <label className="check-row"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /><span>Default plan</span></label>
        <label className="check-row"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span>Active</span></label>
      </div>
    </Modal>
  )
}

// --------------------------------------------------------- export card

function ExportCard() {
  const { user } = useAuth()
  const { data } = useClub()
  const toast = useToast()
  const [xBusy, setXBusy] = useState<string | null>(null)
  const ok = (what: string) => toast.success(`${what} exported`)

  const membersRows = (): SheetRow[] => [
    ['Name', 'Phone', 'Email', 'Type', 'Wallet Balance', 'Due Amount', 'Pass Frames Left', 'Plan', 'Plan Expires', 'Table Discount %', 'Active', 'Created On', 'Notes'],
    ...(data?.members ?? []).map((m) => [
      m.name, m.phone, m.email ?? '', m.type,
      m.walletBalance ?? 0, m.dueAmount ?? 0, m.passFramesLeft ?? 0,
      m.planName ?? '', m.planExpiresAt ? dateStamp(m.planExpiresAt) : '',
      m.tableDiscountPercent ?? 0, m.active !== false ? 'yes' : 'no', dateStamp(m.createdAt), m.notes ?? '',
    ]),
  ]

  const framesRows = (): SheetRow[] => [
    ['Date', 'Table', 'Match', 'Duration Min', 'Players', 'Winners', 'Payers', 'Table Rs', 'Items Rs', 'Bonus', 'Discount', 'Premium Rs', 'Pass Credit Rs', 'Advance Rs', 'Total Rs', 'Paid Rs', 'Due Rs', 'Payment Mode', 'Status'],
    ...(data?.frames ?? []).map((f) => [
      formatDateTime(f.createdAt), f.tableName, f.matchMode, f.durationMinutes,
      (f.players ?? []).map((p) => p.label).join(' | '), (f.winners ?? []).join(' | '), (f.losers ?? []).join(' | '),
      f.tableAmount ?? 0, f.itemsAmount ?? 0, f.winnerBonus ?? 0,
      f.discount ?? 0, f.membershipDiscount ?? 0, f.passTableCredit ?? 0,
      f.advancePaid ?? 0, f.totalAmount ?? 0, f.paidAmount ?? 0,
      f.dueAmount ?? 0, f.paymentMode, f.status,
    ]),
  ]

  const itemBillsRows = (): SheetRow[] => [
    ['Date', 'Customer', 'Member', 'Items', 'Subtotal', 'Discount', 'Total', 'Paid', 'Due', 'Mode', 'Status'],
    ...(data?.itemBills ?? []).map((b) => [
      formatDateTime(b.createdAt), b.customerName, b.memberName ?? '',
      (b.items ?? []).map((i) => `${i.name} x${i.qty}`).join('; '),
      b.subtotal ?? 0, b.discount ?? 0, b.total ?? 0,
      b.paidAmount ?? 0, b.dueAmount ?? 0, b.paymentMode, b.status,
    ]),
  ]

  const expensesRows = (): SheetRow[] => [
    ['Date', 'Title', 'Category', 'Amount', 'Note'],
    ...(data?.expenses ?? []).map((e) => [e.date, e.title, e.category, e.amount ?? 0, e.note ?? '']),
  ]

  /** One button: a whole multi-sheet workbook the accountant expects. */
  const excel = async (which: 'all' | 'members' | 'frames' | 'itemBills' | 'expenses') => {
    setXBusy(which)
    try {
      const sheets: SheetDef[] =
        which === 'members' ? [{ name: 'Members', rows: membersRows() }]
        : which === 'frames' ? [{ name: 'Frames', rows: framesRows() }]
        : which === 'itemBills' ? [{ name: 'Item Bills', rows: itemBillsRows() }]
        : which === 'expenses' ? [{ name: 'Expenses', rows: expensesRows() }]
        : [
            { name: 'Members', rows: membersRows() },
            { name: 'Frames', rows: framesRows() },
            { name: 'Item Bills', rows: itemBillsRows() },
            ...(user?.role !== 'staff' ? [{ name: 'Expenses', rows: expensesRows() }] : []),
          ]
      const suffix = which === 'all' ? 'everything' : which.replace(/([A-Z])/g, '-$1').toLowerCase()
      await downloadXlsx(xlsxName(suffix), sheets)
      ok(`Excel (${sheets.length} sheet${sheets.length > 1 ? 's' : ''})`)
    } catch {
      toast.error('Could not generate the Excel file — refresh and try again')
    } finally {
      setXBusy(null)
    }
  }

  const fullJson = () => {
    downloadJson(`rowdys-den-full-backup-${dateStamp()}.json`, {
      app: "Rowdy's Den — Club Billing",
      kind: 'club-backup',
      exportedAt: new Date().toISOString(),
      club: data?.club,
      tables: data?.tables,
      members: data?.members,
      plans: data?.plans,
      activeSessions: data?.sessions,
      frames: data?.frames,
      menuItems: data?.menuItems,
      itemBills: data?.itemBills,
      expenses: data?.expenses,
      membershipSales: data?.membershipSales,
      stats: data?.stats,
    })
    ok('Full JSON backup')
  }

  return (
    <Card>
      <div className="section-title">Data Export &amp; Backup</div>
      <p className="muted small">
        Every export is <b>built right in your browser</b> — nothing is stored in MongoDB (0 storage). Excel files are zipped, so they're even smaller than CSV, and they open in both Excel and Google Sheets.
      </p>
      <div className="chip-row" style={{ marginTop: 6 }}>
        <Btn size="sm" variant="green" loading={xBusy === 'all'} onClick={() => void excel('all')}>
          <Download size={12} /> All-in-one Excel
        </Btn>
        <Btn size="sm" variant="outline" loading={xBusy === 'members'} onClick={() => void excel('members')}><Download size={12} /> Members.xlsx</Btn>
        <Btn size="sm" variant="outline" loading={xBusy === 'frames'} onClick={() => void excel('frames')}><Download size={12} /> Frames.xlsx</Btn>
        <Btn size="sm" variant="outline" loading={xBusy === 'itemBills'} onClick={() => void excel('itemBills')}><Download size={12} /> Item Bills.xlsx</Btn>
        {user?.role !== 'staff' && (
          <Btn size="sm" variant="outline" loading={xBusy === 'expenses'} onClick={() => void excel('expenses')}><Download size={12} /> Expenses.xlsx</Btn>
        )}
        <Btn size="sm" variant="gold" onClick={fullJson}><FileJson size={12} /> Full Backup (JSON)</Btn>
      </div>
      <p className="muted small" style={{ marginTop: 6 }}>
        The all-in-one Excel packs Members + Frames + Item Bills + Expenses into separate sheets — forward it straight to your accountant.
      </p>
    </Card>
  )
}

// ================================================================ screen

// ------------------------------------------------------------- my profile

function ProfileCard() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [location, setLocation] = useState(user?.location ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    await updateProfile({
      ...(name.trim() ? { name: name.trim() } : {}),
      phone: phone.trim(),
      location: location.trim(),
    })
    setBusy(false)
  }

  return (
    <Card>
      <div style={{ marginBottom: 5 }} className="section-title">My Profile</div>
      <p className="muted small" style={{ margin: '2px 0 6px' }}>
        Your login account ({user?.email}). Phone & city show to Master Admin and help support reach you.
      </p>
      <div className="form-grid two">
        <Field label="Display name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Phone number"><TextInput inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" /></Field>
        <Field label="City / location"><TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Jaipur, Rajasthan" /></Field>
        <span style={{ display: 'grid', marginTop: 15, gap: 6, gridTemplateColumns: '1fr auto' }}>
          <Btn variant="green" size="sm" loading={busy} onClick={save} disabled={!name.trim()}>Save Profile</Btn>
        </span>
      </div>
    </Card>
  )
}

export default function SettingsScreen() {
  const { data, mutate } = useClub()
  const toast = useToast()
  const club = data?.club
  const [name, setName] = useState(club?.name ?? '')
  const [winnerBonus, setWinnerBonus] = useState(String(club?.settings.winnerBonus ?? 0))
  const [dueLimit, setDueLimit] = useState(String(club?.settings.dueLimit ?? 500))
  const [defaultAdvance, setDefaultAdvance] = useState(String(club?.settings.defaultAdvance ?? 0))
  const [monthlyPct, setMonthlyPct] = useState(String(club?.settings.monthlyTableDiscount ?? 0))
  const [logo, setLogo] = useState<string | null | undefined>(undefined) // undefined = unchanged
  const [savingClub, setSavingClub] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [tableModal, setTableModal] = useState<{ table: ClubTable | null } | null>(null)
  const [planModal, setPlanModal] = useState<{ plan: MembershipPlan | null } | null>(null)
  const [delTable, setDelTable] = useState<ClubTable | null>(null)
  const [delPlan, setDelPlan] = useState<MembershipPlan | null>(null)
  const [delBusy, setDelBusy] = useState(false)

  // Logos are downscaled in-browser (canvas) so the save call stays tiny —
  // a huge base64 body used to be rejected by the proxy and looked like a
  // phantom "Authentication required" to the user.
  const pickLogo = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Logo must be an image (png, jpg, webp, gif)')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Logo image is too large (max 8 MB — it gets auto-compressed)')
      return
    }
    const img = new Image()
    img.onload = () => {
      const MAX = 420
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, w, h)
      const out = canvas.toDataURL('image/png')
      URL.revokeObjectURL(img.src)
      setLogo(out)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      toast.error('Could not read that image')
    }
    img.src = URL.createObjectURL(file)
  }

  const saveClub = async () => {
    if (!club) return
    if (logo && logo.length > 1_400_000) {
      toast.error('That logo is still too large even after compression — try a smaller image')
      return
    }
    setSavingClub(true)
    // Name/logo PATCH fires only when actually changed — and the billing
    // settings PATCH never waits on it (a failed photo save must not block the numbers).
    const metaChanged = name.trim() !== club.name || logo !== undefined
    let ok1: unknown = true
    if (metaChanged) {
      const body: Record<string, unknown> = { name: name.trim() || club.name }
      if (logo !== undefined) body.logo = logo ?? ''
      ok1 = await mutate('', { method: 'PATCH', body, toast: 'Club profile updated' })
    }
    const ok2 = await mutate('settings', {
      method: 'PATCH',
      body: {
        winnerBonus: parseNum(winnerBonus),
        dueLimit: parseNum(dueLimit),
        defaultAdvance: parseNum(defaultAdvance),
        monthlyTableDiscount: parseNum(monthlyPct),
      },
      toast: 'Club billing settings saved',
    })
    setSavingClub(false)
    if (ok1 && ok2) setLogo(undefined)
  }

  const toggleTable = async (t: ClubTable) => {
    await mutate(`tables/${t.id}/toggle-active`, { toast: `Table ${t.active ? 'disabled' : 'enabled'} · ${t.name}` })
  }
  const togglePlan = async (p: MembershipPlan) => {
    await mutate(`plans/${p.id}/toggle-active`, { toast: `Plan ${p.active ? 'disabled' : 'enabled'} · ${p.name}` })
  }
  const doDeleteTable = async () => {
    if (!delTable) return
    setDelBusy(true)
    const r = await mutate(`tables/${delTable.id}`, { method: 'DELETE', toast: `Table deleted · ${delTable.name}` })
    setDelBusy(false)
    if (r) setDelTable(null)
  }
  const doDeletePlan = async () => {
    if (!delPlan) return
    setDelBusy(true)
    const r = await mutate(`plans/${delPlan.id}`, { method: 'DELETE', toast: `Plan deleted · ${delPlan.name}` })
    setDelBusy(false)
    if (r) setDelPlan(null)
  }

  const tables = data?.tables ?? []
  const plans = data?.plans ?? []
  const previewLogo = logo !== undefined ? logo : club?.logo ?? null

  return (
    <div className="stack settings-grid" style={{ marginTop: 10 }}>
      <div style={{ display: 'grid', flexDirection: 'column', gap: 10, alignItems: 'start' }}>
        {/* ---------------------------------------------------- My profile (login account) */}
        <ProfileCard />

        {/* ---------------------------------------------------- Club settings */}
        <Card>
          <div style={{ marginBottom: 10 }} className="section-title">Club Settings</div>
        <div className="logo-row">
          <div className="logo-preview">
            {previewLogo ? (
              <img src={previewLogo} alt="Club logo" />
            ) : (
              <span className="logo-empty">RD</span>
            )}
          </div>
          <div className="stack-xs">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden-file"
              onChange={(e) => pickLogo(e.target.files?.[0])}
            />
            <Btn size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={12} /> Upload Logo
            </Btn>
            {previewLogo && (
              <Btn size="sm" variant="ghost" className="danger-text" onClick={() => setLogo(null)}>
                <X size={12} /> Remove Logo
              </Btn>
            )}
            <span className="muted small">PNG/JPG/WebP · auto-compressed to 420px</span>
          </div>
        </div>
          <div className="form-grid two">
            <Field label="Club name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Currency"><div className="input-like">INR · ₹ (fixed)</div></Field>
            <Field label="Winner bonus (₹)"><TextInput inputMode="decimal" value={winnerBonus} onChange={(e) => setWinnerBonus(e.target.value)} /></Field>
            <Field label="Due limit (₹)"><TextInput inputMode="decimal" value={dueLimit} onChange={(e) => setDueLimit(e.target.value)} /></Field>
            <Field label="Default advance (₹)"><TextInput inputMode="decimal" value={defaultAdvance} onChange={(e) => setDefaultAdvance(e.target.value)} /></Field>
            <Field label="Monthly fallback discount (%)"><TextInput inputMode="decimal" value={monthlyPct} onChange={(e) => setMonthlyPct(e.target.value)} /></Field>
          </div>
          <span style={{ display: 'grid', marginTop: 10, gap: 6, gridTemplateColumns: '1fr ' }}>
            <Btn variant="green" loading={savingClub} onClick={saveClub}>Save Settings</Btn>
          </span>
        </Card>
      </div>

      <div style={{ display: 'grid', flexDirection: 'column', gap: 10, alignItems: 'start' }}>
        {/* ---------------------------------------------------- Table pricing */}
        <Card>
          <div className="section-head">
            <div className="section-title">Table Pricing</div>
            <Btn size="sm" variant="green" onClick={() => setTableModal({ table: null })}>
              <Plus size={12} /> Add Table
            </Btn>
          </div>
          <div className="menu-list">
            {tables.map((t) => (
              <div key={t.id} className={`menu-row${t.active ? '' : ' inactive'}`}>
                <span className="menu-name">
                  {t.name}
                  {!t.active && <Badge kind="muted">disabled</Badge>}
                </span>
                <span className="muted small wrap">
                  {formatCurrency(t.rate.hourlyRate)}/hr
                  {/* {t.rate.ratesByPlayers && Object.keys(t.rate.ratesByPlayers).length > 0 && (
                    <> · {Object.entries(t.rate.ratesByPlayers).map(([k, v]) => `${k}P ${formatCurrency(v)}`).join(' ')}</>
                  )} */}
                  {' '}· min {formatCurrency(t.rate.minCharge)}
                  {/* {t.rate.peakHourlyRate ? (
                    <> · <span className="money-gold">peak {formatCurrency(t.rate.peakHourlyRate)}/hr {formatHourRange(t.rate.peakStartHour ?? 0, t.rate.peakEndHour ?? 0)}</span></>
                  ) : null} */}
                  {(t.rate.glovePrice ?? 0) > 0 && <> · glove {formatCurrency(t.rate.glovePrice)}</>}
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className="btn-icon" aria-label={`${t.active ? 'Disable' : 'Enable'} ${t.name}`} title={t.active ? 'Disable' : 'Enable'} onClick={() => toggleTable(t)}>
                    <Power size={12} className={t.active ? 'ok' : 'off'} />
                  </button>
                  <button className="btn-icon" aria-label={`Edit ${t.name}`} title="Edit" onClick={() => setTableModal({ table: t })}>
                    <Pencil size={12} />
                  </button>
                  <button className="btn-icon danger" aria-label={`Delete ${t.name}`} title="Delete" onClick={() => setDelTable(t)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {tables.length === 0 && <p className="muted small">No tables yet.</p>}
          </div>
        </Card>

        {/* -------------------------------------------------- Member plans */}
        <Card>
          <div className="section-head">
            <div className="section-title">Membership Plans</div>
            <Btn size="sm" variant="green" onClick={() => setPlanModal({ plan: null })}>
              <Plus size={12} /> Add Plan
            </Btn>
          </div>
          <p className="muted small">Wallet = prepaid credit · Pass = frame pack · Monthly = premium table % discount</p>
          <div className="menu-list">
            {plans.map((p) => (
              <div key={p.id} className={`menu-row${p.active ? '' : ' inactive'}`}>
                <span className="menu-name">
                  {p.name}
                  <Badge kind="gold">{titleCase(p.type)}</Badge>
                  {p.isDefault && <Badge kind="blue">default</Badge>}
                  {!p.active && <Badge kind="muted">disabled</Badge>}
                </span>
                <span className="muted small nowrap">
                  {formatCurrency(p.amount)}
                  {p.type === 'wallet' && ` → ${formatCurrency(p.value)} wallet`}
                  {p.type === 'pass' && ` → ${Math.trunc(p.value)} frames`}
                  {p.type === 'monthly' && ` → ${p.tableDiscountPercent}% off`}
                  {p.days > 0 ? ` · ${p.days}d` : ' · no expiry'}
                </span>
                <button className="btn-icon" aria-label={`${p.active ? 'Disable' : 'Enable'} ${p.name}`} title={p.active ? 'Disable' : 'Enable'} onClick={() => togglePlan(p)}>
                  <Power size={12} className={p.active ? 'ok' : 'off'} />
                </button>
                <button className="btn-icon" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => setPlanModal({ plan: p })}>
                  <Pencil size={12} />
                </button>
                <button className="btn-icon danger" aria-label={`Delete ${p.name}`} title="Delete" onClick={() => setDelPlan(p)}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {plans.length === 0 && <p className="muted small">No plans yet — create wallet, pass or monthly plans to sell to members.</p>}
          </div>
        </Card>

        {/* -------------------------------------------------- Data export */}
        <ExportCard />
      </div>

      {tableModal && <TableModal onClose={() => setTableModal(null)} table={tableModal.table} />}
      {planModal && <PlanModal onClose={() => setPlanModal(null)} plan={planModal.plan} />}
      <ConfirmModal open={!!delTable} onClose={() => setDelTable(null)} onConfirm={doDeleteTable} busy={delBusy} title="Delete table"
        message={delTable ? `Delete table ${delTable.name}? Tables with active sessions cannot be deleted.` : ''} />
      <ConfirmModal open={!!delPlan} onClose={() => setDelPlan(null)} onConfirm={doDeletePlan} busy={delBusy} title="Delete plan"
        message={delPlan ? `Delete plan ${delPlan.name}? Plans assigned to active members cannot be deleted.` : ''} />
    </div>
  )
}
