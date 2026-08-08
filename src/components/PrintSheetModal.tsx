// A4 report sheet → browser Print / Save-as-PDF (zero server/PDF-lib cost).
// Same trick as ReceiptModal: portal copy at <body>.print-root + @media print.
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { todayLabel } from '../lib/format'
import { Btn, Modal } from './ui'

export function startPrint() {
  document.body.classList.add('do-print')
  const cleanup = () => document.body.classList.remove('do-print')
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
  window.setTimeout(cleanup, 2500)
}

export function SheetPaper({
  clubName,
  title,
  sub,
  children,
}: {
  clubName: string
  title: string
  sub?: string
  children: ReactNode
}) {
  return (
    <div className="sheet">
      <div className="sh-head">
        <div>
          <div className="sh-brand">{clubName}</div>
          <div className="sh-sub">powered by Rowdy&apos;s Den — Club Billing</div>
        </div>
        <div className="sh-meta">
          <div className="sh-title">{title}</div>
          <div className="sh-sub">{sub ?? todayLabel()}</div>
        </div>
      </div>
      <div className="sh-rule" />
      {children}
      <div className="sh-rule" />
      <div className="sh-sub sh-foot">Generated {new Date().toLocaleString('en-IN')} · Rowdy&apos;s Den</div>
    </div>
  )
}

/** Small bordered table for sheets. rows[0] = header; numbers right-aligned via `numCols`.
 *  Wrapped in .sh-scroll so wide sheets swipe on phones instead of clipping. */
export function SheetTable({ rows, numCols = [] }: { rows: Array<readonly ReactNode[]>; numCols?: number[] }) {
  return (
    <div className="sh-scroll">
      <table className="sh-tbl">
        <thead>
          <tr>
            {rows[0]?.map((c, i) => (
              <th key={i} className={numCols.includes(i) ? 'sh-num' : undefined}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((r, ri) => (
            <tr key={ri}>
              {r.map((c, i) => (
                <td key={i} className={numCols.includes(i) ? 'sh-num' : undefined}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PrintSheetModal({
  open,
  onClose,
  title,
  headline,
  sub,
  clubName,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  headline: string
  sub?: string
  clubName: string
  children: ReactNode
}) {
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        width={680}
        footer={
          <>
            <Btn variant="ghost" onClick={onClose}>Close</Btn>
            <Btn variant="green" onClick={startPrint}>
              <Printer size={13} /> Print / Save PDF
            </Btn>
          </>
        }
      >
        <div className="sheet-preview">
          <SheetPaper clubName={clubName} title={headline} sub={sub}>
            {children}
          </SheetPaper>
        </div>
        <p className="muted small center" style={{ marginTop: 6 }}>
          Pick &quot;Save as PDF&quot; in the print dialog for a perfect A4 PDF straight away.
        </p>
      </Modal>
      {open && createPortal(
        <div className="print-root" aria-hidden>
          <SheetPaper clubName={clubName} title={headline} sub={sub}>
            {children}
          </SheetPaper>
        </div>,
        document.body,
      )}
    </>
  )
}
