import { ScrollText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from './ui'

/** Privacy & Policy page (v3.8) — plain-English policy for the SaaS.
    English-only per the UI language rule (Hinglish = Insights + Rowdy Care). */
export default function PrivacyScreen() {
  return (
    <div className="stack info-page">
            <span style={{ marginBottom: '0px' }}></span>

      <Card>
        <div className="section-title">
          <ScrollText size={13} /> Privacy &amp; Policy
        </div>
        <p className="policy-note">Last updated: 8 August 2026</p>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Rowdy's Den — Club Billing ("the app") is billing software for billiards / pool / snooker clubs:
          live table timers, member billing, dues, counter sales, expenses, reports and tournaments. This
          page explains, in plain words, what data the app stores and how it is used.
        </p>
      </Card>

      <Card>
        <div className="section-title">1. What we store</div>
        <ul className="policy-list">
          <li><b>Your account</b> — name, email and profile picture from your Google sign-in, plus your role (owner / staff / master admin). We never see or store your Google password.</li>
          <li><b>Club data you enter</b> — clubs and branches, tables, players &amp; members (including phone numbers and emails), table sessions and frame bills, counter item bills, payments and dues, expenses, tournaments, and activity logs.</li>
          <li><b>Platform data</b> — your subscription plan &amp; status, the seller's support contact, and a record of transactional emails the system produces.</li>
        </ul>
      </Card>

      <Card>
        <div className="section-title">2. How it is used</div>
        <ul className="policy-list">
          <li>Only to run the app for you — billing, reports, dues &amp; alerts, reminders and membership tracking.</li>
          <li>Transactional email to the address on record: trial/subscription status, membership sold, balance summary and expiry reminders.</li>
          <li>WhatsApp is opened only when <b>you</b> tap a reminder or message button — nothing is sent automatically.</li>
          <li>We do <b>not</b> sell your data, show ads, or use your club/member data for marketing. Ever.</li>
        </ul>
      </Card>

      <Card>
        <div className="section-title">3. Cookies &amp; local storage</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          The app uses no tracking cookies. Your browser's local storage keeps only what the app needs to
          work: your session token, theme choice, and walkthrough/tour flags.
        </p>
      </Card>

      <Card>
        <div className="section-title">4. Services we rely on</div>
        <ul className="policy-list">
          <li><b>Google</b> — sign-in (we receive your basic profile: name, email, picture).</li>
          <li><b>MongoDB Atlas</b> — cloud database where your club data lives.</li>
          <li><b>Vercel</b> — hosting that serves the app and its API.</li>
          <li><b>Email (SMTP)</b> — when configured by the platform admin, used only for the transactional emails above.</li>
          <li><b>WhatsApp</b> — only via links you choose to open (reminders, support chat).</li>
        </ul>
      </Card>

      <Card>
        <div className="section-title">5. Club owners' responsibility</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          Member names, phone numbers and emails are entered by your club, for your club's own billing.
          Collect them with the member's knowledge, and send WhatsApp reminders only from your club's own
          number. Staff accounts see operational pages only — finance pages stay owner-only.
        </p>
      </Card>

      <Card>
        <div className="section-title">6. Retention &amp; deletion</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          Your data stays while your account is active. You can export everything anytime from Settings →
          Data Export (Excel / JSON backup). To delete a club or your whole account, email the Master Admin
          from your registered owner account — use the <Link to="/support">Human Support</Link> page in the
          sidebar. Deletion removes the club's billing data; platform records required for accounting may be
          retained in anonymised form.
        </p>
      </Card>

      <Card>
        <div className="section-title">7. Security</div>
        <ul className="policy-list">
          <li>No passwords are ever stored — sign-in is 100% Google OAuth, verified server-side.</li>
          <li>Sessions are short-lived tokens that expire automatically for safety.</li>
          <li>All money calculations happen server-side; every persisted amount is locked and logged.</li>
          <li>Production traffic runs over HTTPS.</li>
        </ul>
      </Card>

      <Card>
        <div className="section-title">8. Changes &amp; contact</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          This policy ships with the app and is updated with product releases — the date at the top always
          marks the latest version. Questions about your data? Head to the{' '}
          <Link to="/support">Human Support</Link> page (sidebar) and reach the Master Admin by call,
          WhatsApp or email.
        </p>
      </Card>
    </div>
  )
}
