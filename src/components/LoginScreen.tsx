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

// v3.17 — owner's brand block: official red logo (public/icons/logo1.png)
// instead of the old billiard-balls SVG mark. Absolute path: LoginScreen can
// render on ANY route, so './icons/…' would 404 on deep links.
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
          <img src="/icons/logo1.png" alt="Rowdy's Den" width={200} />
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
          <p className="login-error">
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
