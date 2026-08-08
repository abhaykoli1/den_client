import { useEffect, useState } from 'react'
import { Headset, Mail, MessageCircle, Phone, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { Btn, Card, EmptyState } from './ui'

type SupportContact = { email: string; phone: string }

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Billing is locked (subscription)?',
    a: 'Plans turn active the moment the Master Admin confirms your payment — any billing lock clears right then. Send your registered account email through any contact option above.',
  },
  {
    q: '"Session expired" keeps showing?',
    a: 'Sessions expire for safety — just sign in again with Google. All club data stays exactly as you left it.',
  },
  {
    q: 'Club limit reached, need one more club?',
    a: 'Your plan fixes the club count (shown in the sidebar switcher). Ask the Master Admin to upgrade the plan — the new club can be created right after.',
  },
  {
    q: "Staff can't open Finance / Expenses?",
    a: 'By design: staff handle billing, players, dues, items and tournaments; money-admin pages stay owner-only.',
  },
  {
    q: 'Want your club data deleted?',
    a: 'Email the Master Admin from your registered owner account with the club name — also see the Privacy & Policy page (sidebar).',
  },
]

/** Human Support page (v3.8) — the Master Admin's contact sheet as a full
    route, plus the fastest self-help paths. English-only per the UI language
    rule (Hinglish msg-tone = Smart Insights + Rowdy Care chat only). */
export default function SupportScreen() {
  const [contact, setContact] = useState<SupportContact>({ email: '', phone: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api('/platform/support')
      .then((c) => { if (alive && c) setContact({ email: c.email ?? '', phone: c.phone ?? '' }) })
      .catch(() => { /* the empty state below covers it */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const waNumber = contact.phone.replace(/[^\d]/g, '')

  return (
    <div className="stack info-page">
      <span style={{ marginBottom: '0px' }}></span>
      <Card>
        <div className="section-title">
          <Headset size={13} /> Talk to the Master Admin
        </div>
        <p className="muted small" style={{ margin: '2px 0 8px' }}>
          Plan upgrades &amp; activation, club limits, account enable/disable — handled directly by the
          platform admin. Pick any channel; your registered email helps them find your account faster.
        </p>
        {loading ? (
          <p className="muted small">Loading contact…</p>
        ) : !contact.phone && !contact.email ? (
          <EmptyState
            title="No contact set yet"
            hint="The Master Admin can add one from Master Admin → Human Support Contact."
          />
        ) : (
          <div className="contact-sheet">
            {contact.phone && (
              <a className="support-alt-row" href={`tel:${contact.phone}`}>
                <Phone size={14} />
                <span>
                  Call us<span className="sub">{contact.phone}</span>
                </span>
              </a>
            )}
            {contact.phone && (
              <a className="support-alt-row" href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">
                <MessageCircle size={14} />
                <span>
                  WhatsApp<span className="sub">Chat on {contact.phone}</span>
                </span>
              </a>
            )}
            {contact.email && (
              <a
                className="support-alt-row"
                href={`mailto:${contact.email}?subject=${encodeURIComponent("Rowdy's Den — support")}`}
              >
                <Mail size={14} />
                <span>
                  Email<span className="sub">{contact.email}</span>
                </span>
              </a>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="section-title">
          <Sparkles size={13} /> Fastest answers — Rowdy Care
        </div>
        <p className="muted small" style={{ margin: '2px 0 8px' }}>
          Billing splits, dues, Day Close, wallets, tournaments, exports — the green chat bubble answers
          instantly, 24×7, on every screen.
        </p>
        <Btn variant="green" size="sm" onClick={() => window.dispatchEvent(new Event('rd:care-open'))}>
          <MessageCircle size={13} /> Open Rowdy Care chat
        </Btn>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Tip: Ctrl K (or ⌘K) jumps straight to any member, table, bill or page.
        </p>
      </Card>

      <Card>
        <div className="section-title">Common questions</div>
        <div className="faq-list">
          {FAQS.map((f) => (
            <div key={f.q} className="faq-item">
              <div className="faq-q">{f.q}</div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
