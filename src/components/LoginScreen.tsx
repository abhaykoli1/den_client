import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { DEV_MODE, GOOGLE_CLIENT_ID } from '../lib/api'
import { Btn, FullLoader, TextInput } from './ui'

declare global {
  interface Window {
    google?: any
  }
}

function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span className="login-mark" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <circle cx="8" cy="9" r="4" fill="#2ecc71" />
        <circle cx="15.5" cy="14" r="4" fill="#f0c14b" />
        <path d="M19 4l1 6" stroke="#f0f1f3" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export default function LoginScreen() {
  const { status, googleLogin, devLogin, loginError, busy } = useAuth()
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const id = 'gis-script'
    const init = () => {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp: { credential: string }) => void googleLogin(resp.credential),
        })
        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            width: 264,
            shape: 'rectangular',
          })
        }
        setGoogleReady(true)
      } catch {
        setGoogleReady(false)
      }
    }
    if (window.google?.accounts?.id) {
      init()
      return
    }
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.id = id
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.defer = true
      s.onload = init
      document.head.appendChild(s)
    }
  }, [])

  const submitDev = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await devLogin(email, name)
    if (ok) {
      setEmail('')
      setName('')
    }
  }

  if (status === 'loading') return <FullLoader label="Restoring session…" />

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <BrandMark />
          <div>
            <div className="login-title">Rowdy&rsquo;s Den</div>
            <div className="login-sub">Club Billing</div>
          </div>
        </div>

        <div className="login-secure">
          <Lock size={12} />
          <span>Secure access · accounts &amp; subscriptions are controlled by Master Admin</span>
        </div>

        {GOOGLE_CLIENT_ID ? (
          <div className="login-google">
            <div ref={googleBtnRef} className={busy ? 'is-busy' : ''} />
            {!googleReady && <p className="muted small">Loading Google sign-in…</p>}
          </div>
        ) : (
          <p className="login-error small">
            Google sign-in is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> and{' '}
            <code>GOOGLE_CLIENT_ID</code> (same Web Client ID) to enable it.
          </p>
        )}

        {loginError && <div className="login-error">{loginError}</div>}

        {DEV_MODE && (
          <form className="login-dev" onSubmit={submitDev}>
            <div className="login-dev-title">
              <ShieldCheck size={12} />
              <span>Development sign-in</span>
            </div>
            <TextInput
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Development email"
              required
            />
            <TextInput
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Development name"
            />
            <Btn variant="green" type="submit" loading={busy} className="btn-block">
              Sign in (dev)
            </Btn>
          </form>
        )}

        <p className="login-foot">Access, plans and club limits are managed from the Master Admin panel.</p>
      </div>
    </div>
  )
}
