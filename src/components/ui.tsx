// Small shared UI primitives (plain CSS, compact operational style).
import { useEffect, type HTMLAttributes, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { X, Loader2 } from 'lucide-react'

export function Spinner({ size = 14 }: { size?: number }) {
  return <Loader2 className="spin" size={size} aria-label="Loading" />
}

/** Bouncing billiard 8-ball — the house loading mascot (replaces spinners on full-page loads). */
export function EightBallLoader({ size = 46 }: { size?: number }) {
  return (
    <div className="eb-wrap" role="status" aria-label="Loading">
      <div className="eightball" style={{ width: size, height: size }}>
        <span className="eightball-num" style={{ fontSize: Math.max(11, size * 0.3) }}>8</span>
      </div>
      <div className="eb-shadow" style={{ width: size * 0.8 }} />
    </div>
  )
}

export function FullLoader({ label = '' }: { label?: string }) {
  return (
    <div className="full-loader">
      <EightBallLoader />
      {label ? <span className="small muted">{label}</span> : null}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'green' | 'blue' | 'red' | 'gold' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Btn({ variant = 'outline', size = 'md', loading, disabled, className = '', children, ...rest }: BtnProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}${loading ? ' is-loading' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size={12} />}
      {children}
    </button>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

// v3.13 — className passed by a caller must ADD to the base design classes,
// never replace them. Tournaments' match card was silently losing .input /
// .select (browser-native white boxes) because {...props} overrode className.
export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`.trim()} {...rest} />
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input textarea ${className}`.trim()} rows={2} {...rest} />
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`input select ${className}`.trim()} {...rest} />
}

export function Badge({ kind = 'muted', children }: { kind?: 'green' | 'gold' | 'red' | 'blue' | 'muted' | 'dark'; children: ReactNode }) {
  return <span className={`badge badge-${kind}`}>{children}</span>
}

export function Card({ className = '', children, ...rest }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`.trim()} {...rest}>{children}</div>
}

export function StatCard({ label, value, tone = 'green', sub }: { label: string; value: ReactNode; tone?: 'green' | 'red' | 'blue' | 'gold'; sub?: ReactNode }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
    </div>
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  width?: number
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, onClose, title, width = 460, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="btn-icon" aria-label="Close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, busy, confirmLabel = 'Delete' }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  busy?: boolean
  confirmLabel?: string
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={360}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="red" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <p className="muted small">{message}</p>
    </Modal>
  )
}

export function Seg<T extends string>({ options, value, onChange, ariaLabel }: {
  options: Array<{ value: T; label: ReactNode }>
  value: T
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`seg-btn${value === o.value ? ' active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
