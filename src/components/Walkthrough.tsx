// Guided walkthrough ("App Tour") — spotlight overlay that walks a new owner
// through the whole product. Auto-launches once per device (localStorage),
// replayable any time from the sidebar Tour button. Design: same tokens,
// same compact card language — no external tour library.
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { setItem } from '../lib/storage'

interface TourStep {
  /** navigate here before showing the step (optional) */
  route?: string
  /** css selector to spotlight — first match wins; missing → centered card */
  sel?: string
  title: string
  body: string
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to Rowdy's Den 🎱",
    body: 'A 2-minute tour of the whole app — tables, billing, players, dues, stock, reports. Press Next to start (Esc anytime to exit).',
  },
  {
    sel: '.club-switch',
    title: 'Your club lives here',
    body: 'Running more than one club or branch? Switch between them from this dropdown, or tap + to add a new one (within your plan limit).',
  },
  {
    sel: '.side-chips',
    title: 'Today & Due at a glance',
    body: 'These two chips are your pulse: today’s collection (from the payment ledger) and total member due — always visible, no digging.',
  },
  {
    sel: '.nav',
    title: 'Everything in one menu',
    body: 'Tables, Players, Due Desk, Item Billing, Tournaments, Frames & Logs. The Admin dropdown (reports, expenses, staff) stays tucked at the very bottom.',
  },
  {
    route: '/tables',
    sel: '.grid-stats',
    title: 'Live counters',
    body: 'Total due, today’s earnings and your due limit — refreshed the moment anything bills or settles.',
  },
  {
    route: '/tables',
    sel: '.table-grid',
    title: 'Tables = billing cockpit',
    body: 'Pick players (members or guests), assign gloves, tap Start. While a table runs you can add counter items, take advance, write a note, or move the session. Stop → winner pick → money settled automatically.',
  },
  {
    route: '/tables',
    sel: '.card.insights',
    title: 'Smart Insights',
    body: 'The app reads your data and nudges you — low stock, long-running tables, dues crossing limits. Tip: insights keep their chatty tone on purpose.',
  },
  {
    sel: '[data-tour="t-search"]',
    title: 'Jump anywhere with Ctrl K',
    body: 'Member, table, item, page — search and jump instantly. This is the fastest way around the app.',
  },
  {
    sel: '.alerts-wrap',
    title: 'The bell warns early',
    body: 'Low stock, dues crossing limits, memberships about to expire — the bell collects everything that needs your attention today.',
  },
  {
    sel: '.side-tools',
    title: 'Theme · Refresh · Tour',
    body: 'Dark/Light in one tap, data refresh beside it, and this very tour whenever you want a recap.',
  },
  {
    sel: '.support-fab',
    title: 'Rowdy Care, 24×7',
    body: 'Confused about any screen? The green bubble answers instantly — how billing splits, what reports mean, or where a setting lives. Need a human? Sidebar → Human Support (below Settings) has call, WhatsApp & email.',
  },
  {
    title: "You're all set ✅",
    body: 'Start a table, sell a membership, bill an item — the books keep themselves. Day Close (Admin dropdown) at night matches your drawer in one click.',
  },
]

interface Box {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 6

export default function Walkthrough({ active, onClose }: { active: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const step = STEPS[i]

  const finish = useCallback(() => {
    setItem('tourDone', '1')
    onClose()
  }, [onClose])

  // fresh start every time the tour opens
  useEffect(() => {
    if (active) {
      setI(0)
      setBox(null)
    }
  }, [active])

  // navigate to the step's route, then find + spotlight the target
  useLayoutEffect(() => {
    if (!active) return
    let cancelled = false
    let tries = 0
    const locate = () => {
      if (cancelled) return
      const el = step.sel ? document.querySelector(step.sel) : null
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        window.setTimeout(() => {
          if (cancelled) return
          const r = el.getBoundingClientRect()
          if (r.width > 4 && r.height > 4) {
            setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
            return
          }
          retry()
        }, 260)
        return
      }
      retry()
    }
    const retry = () => {
      if (cancelled) return
      tries += 1
      if (tries > 20) {
        setBox(null) // centered card fallback
        return
      }
      window.setTimeout(locate, 130)
    }
    if (step.route && !location.pathname.startsWith(step.route)) {
      navigate(step.route)
      setBox(null)
      window.setTimeout(locate, 320)
    } else {
      locate()
    }
    return () => {
      cancelled = true
    }
  }, [active, i, location.pathname])

  // keep the spotlight glued on resize/scroll
  useEffect(() => {
    if (!active || !step.sel) return
    const remeasure = () => {
      const el = document.querySelector(step.sel!)
      if (!el) return setBox(null)
      const r = el.getBoundingClientRect()
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
    }
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [active, i, step.sel])

  // Esc closes, arrows navigate
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight') setI((v) => Math.min(STEPS.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finish])

  if (!active) return null

  const last = i === STEPS.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  const W = Math.min(320, vw - 24)

  // tooltip placement: below the target when there is room, else above, else centered
  let tipStyle: React.CSSProperties = { width: W, left: (vw - W) / 2, top: (vh - 180) / 2 }
  if (box) {
    const below = box.top + box.height + 12
    const aboveTop = box.top - 12 - 190
    const top = below + 190 < vh ? below : Math.max(10, aboveTop)
    const left = Math.min(Math.max(box.left + box.width / 2 - W / 2, 12), vw - W - 12)
    tipStyle = { width: W, left, top }
  }

  return createPortal(
    <div className="tour-root" role="dialog" aria-label={`App tour step ${i + 1} of ${STEPS.length}: ${step.title}`}>
      <div className="tour-dim" onClick={finish} />
      {box && <div className="tour-spot" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />}
      <div className="tour-tip" style={tipStyle}>
        <div className="tour-head">
          <span className="tour-count">
            {i + 1} / {STEPS.length}
          </span>
          <span className="tour-title">{step.title}</span>
          <button className="btn-icon" aria-label="Close tour" onClick={finish}>
            <X size={13} />
          </button>
        </div>
        <p className="tour-body">{step.body}</p>
        <div className="tour-foot">
          <button className="btn btn-sm btn-ghost" onClick={finish}>
            Skip
          </button>
          <span className="spacer" />
          {i > 0 && (
            <button className="btn btn-sm" onClick={() => setI(i - 1)}>
              <ChevronLeft size={13} /> Back
            </button>
          )}
          <button className="btn btn-sm btn-green" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? 'Finish' : 'Next'} <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
