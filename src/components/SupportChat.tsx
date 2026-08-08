import { useEffect, useRef, useState } from 'react'
import { Headset, Send, Sparkles, X } from 'lucide-react'
import { api } from '../lib/api'

type Msg = { from: 'bot' | 'user'; text: string }
type SupportContact = { email: string; phone: string }

const QUICK = ['Table billing', 'Day Close kya hai', 'Due collect kaise', 'Advance / Note / Move', 'League tournament', 'Stock kam ho to', 'Excel & PDF export', 'Human se baat']

const WELCOME: Msg = {
  from: 'bot',
  text: 'Namaste! Main Rowdy Care hoon 👋 — billing, dues, day close, tournaments, exports… jo bhi help chahiye pooch lo, ya quick topic chuno. Quick tip: Ctrl K se kahin bhi jump kar sakte ho.',
}

/** Rule-based customer-care brain — keywords matched, Hinglish answers (v3 aware).
    Human-support contact comes from the Master Admin (platform support contact). */
function botReply(qRaw: string, contact: SupportContact): string {
  const q = qRaw.toLowerCase()
  const has = (...keys: string[]) => keys.some((k) => q.includes(k))

  if (has('hi', 'hello', 'hey', 'namaste', 'yo'))
    return 'Hello! 😊 Kya chal raha hai — table billing, dues, day close, exports ya tournaments? Quick topics neeche bhi hain.'

  // -------- core billing
  if (has('table', 'billing', 'timer', 'frame', 'session start'))
    return 'Tables screen pe free table pe players choose karo (solo / 2v2) → Start. Timer chalega, items chips se bill me jud jayenge. Stop → winner mark karo (winner kabhi pay nahi karta!) → Confirm → receipt turant print bhi le sakte ho. Amount server se compute hota hai — 2 decimals tak exact (₹280/hr × 1 min = ₹4.67).'

  if (has('advance', 'note', 'move', 'swap', 'shift'))
    return 'Chalte session pe 3 quick actions hain: Advance (paisa turant day-close me jud jata hai aur bill se adjust hota hai), Note (VIP request style — final bill tak saath chalti hai), Move (session doosri free table pe shift — timer wahin se chalta rehta hai, rate naye table ka lag jata hai). Occupied card pe Stop ke upar wali row me milega.'

  if (has('winner', 'galat', 'correct', 'ulta'))
    return 'Winner galti se galat mark ho gaya? Frames history → Change Winner: purana settlement poora reverse hota hai (wallet refund, due hat, pass frames wapas) aur bill naye side pe re-compute hota hai — cash wapas nahi, re-apply hota hai.'

  // -------- money / dues
  if (has('due', 'udhaar', 'baaki', 'collection', 'collect'))
    return 'Due Desk pe saare udhaar upar-sorted dikhte hain. Part payment chalta hai — aur ab har row pe WhatsApp Remind bhi hai (prefilled polite message, phone saved ho to). Full payment se member list se hat jata hai. Due Limit Settings se control hota hai — 70% pe bell gold, 100% pe red alert.'

  if (has('wallet'))
    return 'Wallet = prepaid paisa. Player card pe Sell Plan → wallet plan do → paisa club ke paas, credit member ke naam. Bill pe wallet PEHLE auto-apply hota hai. Baaki jo bache wo cash/UPI ya due ban jata hai.'

  if (has('pass'))
    return 'Frame Pass prepaid frames deta hai (full hourly rate pe 1 frame = 1 pass use). Bill me member eligible ho to "Frame pass · name (N frames left)" dikhta hai — ek bill me ek hi pass, aur due walo ko nahi milta.'

  if (has('day close', 'dayclose', 'closing', 'rozana', 'hisaab', 'drawer'))
    return 'Admin → Day Close: us din ka poora hisaab ek page pe — cash/UPI/card alag-alag, source-wise (frames/items/plans/due/tournaments), kharch, TOP 5 items, aur last me "drawer me ₹X hona chahiye" wali line. Print/PDF button se closing slip bhi le lo. Counter shift ke end me sabse useful cheez.'

  if (has('excel', 'pdf', 'csv', 'export', 'download', 'backup', 'sheet'))
    return 'Reports ab Excel (.xlsx) ya PDF me: Settings → Data Export (members/frames/bills/expenses — alag sheets me All-in-one Excel bhi hai) · Finance me P&L/Daily/Stock Excel + PDF · Monthly Revenue & Day Close pe bhi Excel/PDF. Saari files browser me hi banti hai — server/MongoDB me kuch store nahi hota (0 storage, aur file zipped hone se chhoti). Poora backup chahe to "Full Backup (JSON)".'

  if (has('receipt', 'print', 'thermal', 'printer', 'bill nik'))
    return '58mm thermal receipt: final bill confirm hote hi khulti hai; baad me Frames / Item Bills rows pe 🖨 icon se dobara print. Normal printer pe "Save as PDF" bhi ho jata hai. A4 reports (Day Close / P&L / Monthly) pe alag Print-PDF button hai.'

  // -------- stock
  if (has('stock', 'item', 'cafe', 'snack', 'sell', 'restock', 'maal'))
    return 'Items pe sale price + purchase price + reorder level set karo. Stock reorder level ke neeche → red pill + bell alert + Smart Insights warning. Restock karte hi purchase khud expenses me likh jata hai, profit per item Finance → Stock Profit sheet me. Counter pe out-of-stock chips lock rehti hain — galti se sale nahi hogi.'

  // -------- tournaments
  if (has('league', 'round robin', 'points'))
    return 'League tournament: create pe Format = League chuno (baad me lock). Sab players ek dusre se ek baar khelenge (har game = fixture), jeet = 3 points, tie pe frame difference. Points table live update hoti hai aur sab fixtures khatam hote hi topper auto-champion — prizes auto-expense. Fixtures same bracket-style match cards me dikhte hain.'

  if (has('tournament', 'bracket', 'match', 'knockout'))
    return 'Knockout: New Tournament → entry fee + prizes + date → players phone ke saath add → Start · Make Bracket (byes auto). Match ko "On Table" karo to timer + table charge chalega — loser pays (rate × minutes, 2-dp exact). Champion hote hi prize payouts expenses me book. Format league rakhna ho to create ke time hi choose karna.'

  // -------- membership
  if (has('monthly', 'premium', 'member', 'plan bech'))
    return 'Monthly/Premium plan = fixed % off table amount, expiry ke saath. Expire hone se 7 din pehle topbar bell alert karti hai. Highest % valid premium hi bill pe lagta hai (due wala member nahi le sakta).'

  // -------- settings / admin
  if (has('peak', 'rush', 'evening rate'))
    return 'Peak pricing: Settings → Table Pricing → Peak ₹/hr + window (jaise 18–23). Us time table peak rate pe chalti hai (per-player rates off), cards pe "peak rate" badge. Baaki time normal rate. Raat ke window (23–2) bhi chalte hain.'

  if (has('utilisation', 'peak hours', 'kaunsa table'))
    return 'Finance → Table Utilisation: is mahine kaunsi table kitne time busy rahi, kitna revenue, effective ₹/hr, aur top-3 peak hours — staff-shift isi hisaab se set karo.'

  if (has('setting', 'limit', 'logo', 'discount', 'currency'))
    return 'Settings me: Club Settings (logo, winner bonus, due limit, default advance), Table Pricing (rates + peak window), Membership Plans (wallet/pass/monthly) aur Data Export & Backup (Excel/JSON). Sab save hote hi poori app me apply.'

  if (has('finance', 'profit', 'loss', 'balance', 'p&l', 'kamaya', 'monthly'))
    return 'Finance screen = month-end poora hisaab: income (cash-basis), expenses, P&L, Balance Sheet (dues + stock − wallets), Stock Profit sheet, Daily cash flow — sab Excel/PDF me. Monthly Revenue sheet (Admin group) sirf collections dikhati hai source-wise — chaaro cheeze compare karke dekh.'

  if (has('bell', 'alert', 'notification'))
    return 'Topbar ki 🔔 bell 3 alert deti hai: low stock (reorder level ke neeche), due-limit pressure (70%+), expiring premium plans (≤7 din). Click karo to seedha us page pe le jaati hai.'

  if (has('search', 'ctrl', 'dhoondh', 'find', 'jump'))
    return 'Ctrl K (ya ⌘K) se Quick Search khulti hai — member, table, item, bill ya page type karo aur jump! Due member seedha Due Desk pe khul jata hai.'

  if (has('pwa', 'install', 'app download', 'home screen'))
    return 'Yeh PWA hai — Chrome/Edge ke address bar me install icon (ya phone me "Add to Home Screen") dabao to app ki tarah khulegi. Static files offline cache hoti hain; billing data hamesha live.'

  if (has('staff', 'team', 'employee', 'kaun'))
    return 'Staff billing, players, due, items aur tournaments handle karte hain — revenue/finance/expenses sirf owner ko. Club-wise handlers Admin → Club Staff tab pe. Staff ko aksar sirf counter kaam dena ho to unke login me finance kuch nahi dikhta.'

  if (has('login', 'sign', 'logout', 'password', 'khao'))
    return 'Login Google sign-in (dev mode pe email se bhi). "Session expired" aaye to ek baar phir sign in — data safe rehta hai. Plan pending ho to Master Admin activate karega.'

  if (has('plan', 'pricing', 'price', 'subscription', 'paisa kitna', 'cost'))
    return 'Seller plans Master Admin panel se milte hain (trial bhi hota hai). Status topbar ke badge pe. Upgrade/club-limit ke liye "Human se baat" chuno.'

  if (has('human', 'band', 'master', 'contact', 'call', 'phone', 'email', 'agent', 'insaan', 'human se baat'))
    return [
      `Human support — Master Admin se direct baat karo: ✉️ ${contact.email || 'email set nahi hua'}${
        contact.phone ? ` ya 📞 ${contact.phone}` : ''
      }. Plan upgrades, account enable/disable, club limit — sab wahi handle karte hain.`,
      contact.phone ? 'Sidebar me Settings ke neeche "Human Support" page hai — wahan se call, WhatsApp ya email ek tap pe.' : '',
    ].filter(Boolean).join(' ')

  if (has('thank', 'shukriya', 'nice', 'great', 'ok', 'sahi'))
    return 'Anytime! 🎱 Aur kuch ho to pooch lo — Day Close khol ke dekho, roz ka hisaab wahi se clear hoga.'

  return 'Hmm, exact jawab mere paas nahi — par in sab pe expert hoon: Table billing · Advance/Note/Move · Due & WhatsApp remind · Day Close · Wallet/Pass/Monthly · Tournaments (knockout + league) · Stock & reorder · Excel/PDF exports · Peak pricing · Ctrl K search · Staff roles. Ya "Human se baat" ✉️.'
}

/** Floating customer-care chat, available on every screen. */
export default function SupportChat() {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [contact, setContact] = useState<SupportContact>({ email: '', phone: '' })
  const bottomRef = useRef<HTMLDivElement>(null)

  // Human-support contact, configured by Master Admin. Loaded once per mount —
  // bot answers use it; the call / WhatsApp / email sheet itself is the sidebar
  // Human Support page (SupportScreen.tsx, v3.8).
  useEffect(() => {
    let alive = true
    api('/platform/support')
      .then((c) => { if (alive && c) setContact({ email: c.email ?? '', phone: c.phone ?? '' }) })
      .catch(() => { /* silent: chat still works without it */ })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, typing, open])

  // Human Support page (and anywhere else) can pop the chat open directly.
  useEffect(() => {
    const openCare = () => {
      setOpen(true)
      setSeen(true)
    }
    window.addEventListener('rd:care-open', openCare)
    return () => window.removeEventListener('rd:care-open', openCare)
  }, [])

  const send = (text: string) => {
    const q = text.trim()
    if (!q || typing) return
    setMsgs((m) => [...m, { from: 'user', text: q }])
    setInput('')
    setTyping(true)
    window.setTimeout(() => {
      setMsgs((m) => [...m, { from: 'bot', text: botReply(q, contact) }])
      setTyping(false)
    }, 650)
  }

  return (
    <>
      {open && (
        <div className="support-panel" role="dialog" aria-label="Customer care chat">
          <div className="support-head">
            <span className="support-avatar">
              <Headset size={15} />
            </span>
            <div className="grow">
              <div className="support-title">Rowdy Care</div>
              <div className="support-sub">Customer care · turant jawab</div>
            </div>
            <span className="live-badge sm">
              <span className="live-dot" /> ONLINE
            </span>
            <button className="btn-icon" aria-label="Close chat" onClick={() => setOpen(false)}>
              <X size={13} />
            </button>
          </div>

          <div className="support-msgs">
            {msgs.map((m, i) => (
              <div key={i} className={`support-msg ${m.from}`}>
                {m.text}
              </div>
            ))}
            {typing && (
              <div className="support-msg bot typing">
                <span /><span /><span />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="support-chips">
            {QUICK.map((c) => (
              <button key={c} type="button" className="chip" onClick={() => send(c)}>
                {c}
              </button>
            ))}
          </div>

          <div className="support-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder="Apna sawaal likho…"
              aria-label="Chat message"
            />
            <button className="support-send" aria-label="Send" onClick={() => send(input)}>
              <Send size={13} />
            </button>
          </div>
        </div>
      )}

      <button
        className="support-fab"
        aria-label={open ? 'Close customer care' : 'Open customer care chat'}
        onClick={() => {
          setOpen(!open)
          setSeen(true)
        }}
      >
        {open ? <X size={17} /> : <Headset size={17} />}
        {!open && !seen && (
          <span className="support-hello">
            <Sparkles size={9} /> Help?
          </span>
        )}
      </button>
    </>
  )
}
