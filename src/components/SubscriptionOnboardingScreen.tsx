import { useEffect, useState } from 'react'
import { BadgeCheck, Check, Clock, LogOut, RefreshCw, Star } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, asArray } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { Btn, Badge, FullLoader, Spinner } from './ui'
import type { SaaSPlan } from '../types'

/** Shown after sign-in, before any club access: plan selection / pending gate. */
export default function SubscriptionOnboardingScreen() {
  const { user, logout, refreshUser } = useAuth()
  const toast = useToast()
  const [plans, setPlans] = useState<SaaSPlan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const sub = user?.subscription
  const pending = sub && sub.status !== 'trial' && sub.status !== 'active'

  useEffect(() => {
    api('/subscription-plans')
      .then((p) => setPlans(asArray<SaaSPlan>(p)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load plans'))
  }, [])

  const select = async (plan: SaaSPlan) => {
    setSelecting(plan.id)
    try {
      await api('/account/subscription/select', { method: 'POST', body: { planId: plan.id } })
      if (plan.trialDays > 0) {
        toast.success(`Trial started · ${plan.name}`)
      } else {
        toast.info('Plan selected — awaiting Master Admin activation')
      }
      await refreshUser()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not select plan')
    } finally {
      setSelecting(null)
    }
  }

  const checkStatus = async () => {
    setChecking(true)
    await refreshUser()
    setChecking(false)
    toast.info('Subscription status refreshed')
  }

  return (
    <div className="onboard-wrap">
      <div className="onboard-head">
        <div className="login-title">Choose your plan</div>
        <div className="muted small">
          Signed in as {user?.name} ({user?.email}) · Rowdy&rsquo;s Den Club Billing
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {pending && (
        <div className="pending-card">
          <Clock size={22} className="warn-text" />
          <div className="pending-title">Awaiting activation</div>
          <p className="muted small" style={{ textAlign: 'center' }}>
            Your <b>{sub.planName}</b> plan is <Badge kind="red">{sub.status}</Badge>. A Master Admin must
            activate it before club access opens.
          </p>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            <Btn variant="green" loading={checking} onClick={checkStatus}>
              <RefreshCw size={13} /> Check Status
            </Btn>
            <Btn variant="ghost" onClick={logout}>
              <LogOut size={13} /> Sign Out
            </Btn>
          </div>
          {plans && plans.length > 0 && (
            <p className="muted small">…or pick a different plan below (a trial starts immediately).</p>
          )}
        </div>
      )}

      {!plans && !error && <FullLoader label="Loading plans…" />}

      <div className="plan-grid">
        {(plans ?? []).map((p) => (
          <div key={p.id} className={`plan-card${p.recommended ? ' recommended' : ''}`}>
            {p.recommended && (
              <span className="plan-reco">
                <Star size={10} /> Recommended
              </span>
            )}
            <div className="plan-name">{p.name}</div>
            <div className="plan-price">
              {formatCurrency(p.price)}
              <span className="plan-cycle">/{p.billingCycle === 'yearly' ? 'year' : 'month'}</span>
            </div>
            {p.description && <p className="muted small">{p.description}</p>}
            <ul className="plan-feats">
              <li>
                <BadgeCheck size={12} /> {p.maxClubs} club{p.maxClubs > 1 ? 's' : ''}
              </li>
              {p.trialDays > 0 && (
                <li>
                  <Clock size={12} /> {p.trialDays}-day free trial
                </li>
              )}
              {p.features.map((f) => (
                <li key={f}>
                  <Check size={12} /> {f}
                </li>
              ))}
            </ul>
            <Btn
              variant={p.trialDays > 0 ? 'green' : 'blue'}
              className="btn-block"
              loading={selecting === p.id}
              onClick={() => select(p)}
            >
              {selecting === p.id ? <Spinner size={12} /> : null}
              {p.trialDays > 0 ? `Start ${p.trialDays}-day Trial` : 'Select Plan'}
            </Btn>
          </div>
        ))}
        {plans && plans.length === 0 && (
          <div className="empty" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-title">No plans available yet</div>
            <div className="empty-hint">A Master Admin must create seller subscription plans first.</div>
            <Btn variant="ghost" onClick={logout}>
              <LogOut size={13} /> Sign Out
            </Btn>
          </div>
        )}
      </div>

      {!pending && (
        <button className="signout-link" onClick={logout}>
          Sign out
        </button>
      )}
    </div>
  )
}
