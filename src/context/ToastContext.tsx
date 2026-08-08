import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastCtx {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}

const Ctx = createContext<ToastCtx>({
  success: () => undefined,
  error: () => undefined,
  info: () => undefined,
})

const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={15} />,
  error: <AlertTriangle size={15} />,
  info: <Info size={15} />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { id, kind, message }]) // keep stack short
      const ttl = kind === 'error' ? 6000 : 3000
      window.setTimeout(() => dismiss(id), ttl)
    },
    [dismiss],
  )

  const value = useMemo<ToastCtx>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-icon">{ICONS[t.kind]}</span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx)
}
