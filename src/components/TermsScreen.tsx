import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from './ui'

/** Terms & Conditions page (v3.9) — plain-English terms for the SaaS.
    English-only per the UI language rule (Hinglish = Insights + Rowdy Care). */
export default function TermsScreen() {
  return (
    <div className="stack info-page">
            <span style={{ marginBottom: '0px' }}></span>

      <Card>
        <div className="section-title">
          <FileText size={13} /> Terms &amp; Conditions
        </div>
        <p className="policy-note">Last updated: 8 August 2026</p>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          These terms govern the use of Rowdy's Den — Club Billing ("the app"). By signing in and using the
          app, you agree to them. They are written in plain words on purpose — if anything is unclear, ask
          from the <Link to="/support">Human Support</Link> page.
        </p>
      </Card>

      <Card>
        <div className="section-title">1. The service</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          The app is subscription software for billiards / pool / snooker clubs: live table timers, member
          billing, dues, counter sales with stock, expenses, financial reports, tournaments and data exports.
          All money amounts are computed and locked by the server; screens show live estimates.
        </p>
      </Card>

      <Card>
        <div className="section-title">2. Accounts &amp; roles</div>
        <ul className="policy-list">
          <li>Sign-in is via Google. You are responsible for every action taken under your account.</li>
          <li>The <b>club owner</b> is responsible for their club's data and for the staff accounts they add — staff see operational pages only, by design.</li>
          <li>The <b>Master Admin</b> (platform seller) manages subscription plans, user access and the support contact — never your day-to-day club data entry.</li>
        </ul>
      </Card>

      <Card>
        <div className="section-title">3. Subscription &amp; billing</div>
        <ul className="policy-list">
          <li>New accounts may start on a <b>trial</b>; paid plans activate only after the Master Admin confirms payment.</li>
          <li>When a subscription isn't active, billing features lock (a 402 state) — your data stays safe and visible.</li>
          <li>Each plan fixes limits (e.g. number of clubs). Upgrades take effect as soon as the Master Admin applies them.</li>
          <li>Fees are for the subscription period and are non-refundable, except at the platform's discretion.</li>
        </ul>
      </Card>

      <Card>
        <div className="section-title">4. Your data</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          Your club's data belongs to you. You grant the app permission to store and process it only to
          operate the service (billing, reports, reminders, exports). You can export everything anytime from
          Settings → Data Export. How data is stored, used and deleted is covered in the{' '}
          <Link to="/privacy">Privacy &amp; Policy</Link> page.
        </p>
      </Card>

      <Card>
        <div className="section-title">5. Acceptable use</div>
        <ul className="policy-list">
          <li>Use the app only for lawful club business you are authorised to run.</li>
          <li>No scraping, reverse-engineering, or attempts to access another club's or user's data.</li>
          <li>Send WhatsApp reminders only to your own members, from your own number, with their knowledge.</li>
          <li>Accounts involved in abuse, fraud or misuse can be suspended.</li>
        </ul>
      </Card>

      <Card>
        <div className="section-title">6. Accuracy &amp; your responsibility</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          The server computes, locks and logs every persisted amount — but the club is responsible for what
          it enters: table rates, stock quantities, expenses, tournament prizes, and for its own legal
          bookkeeping and taxes. Reports (Day Close, P&amp;L, revenue sheets) are operational aids, not
          audited financial statements.
        </p>
      </Card>

      <Card>
        <div className="section-title">7. Availability &amp; changes</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          The service is provided on a best-effort basis. Maintenance, updates and feature changes ship with
          product releases; we try to keep the app available around the clock but don't promise uninterrupted
          uptime.
        </p>
      </Card>

      <Card>
        <div className="section-title">8. Suspension &amp; termination</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          You can stop using the app anytime. The platform may disable accounts for non-payment or breach of
          these terms. After termination, data export or deletion follows the{' '}
          <Link to="/privacy">Privacy &amp; Policy</Link> page.
        </p>
      </Card>

      <Card>
        <div className="section-title">9. Liability</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          The app is provided "as is". The platform is not liable for indirect losses — lost profits, lost
          data, or business interruption. In any case, total liability is capped at the subscription fees you
          paid in the last 3 months.
        </p>
      </Card>

      <Card>
        <div className="section-title">10. Governing law &amp; contact</div>
        <p className="muted small" style={{ margin: '2px 0 0' }}>
          These terms are governed by the laws of India, with jurisdiction at Jaipur, Rajasthan. Questions
          about the terms? Reach the Master Admin by call, WhatsApp or email from the{' '}
          <Link to="/support">Human Support</Link> page (sidebar).
        </p>
      </Card>
    </div>
  )
}
