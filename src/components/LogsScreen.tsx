import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useClub } from '../context/ClubContext'
import { formatCurrency, formatDateTime, modeBadge } from '../lib/format'
import { Badge, EmptyState, Seg } from './ui'
import type { LogTag } from '../types'

const TAG_KIND: Record<string, 'green' | 'red' | 'gold' | 'blue'> = {
  PAYMENT: 'green',
  WARNING: 'red',
  ADMIN: 'gold',
  BILLING: 'blue',
}

export default function LogsScreen() {
  const { data } = useClub()
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<'ALL' | LogTag>('ALL')

  const logs = data?.logs ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs
      .filter((l) => tag === 'ALL' || l.tag === tag)
      .filter((l) => !q || l.message.toLowerCase().includes(q) || (l.memberName || '').toLowerCase().includes(q) || (l.note || '').toLowerCase().includes(q))
  }, [logs, search, tag])

  return (
    <div className="stack">
      <div className="page-head">
        <div className="row logs-filter">
          <Seg
            value={tag}
            onChange={(v) => setTag(v as 'ALL' | LogTag)}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'BILLING', label: 'Billing' },
              { value: 'PAYMENT', label: 'Payment' },
              { value: 'WARNING', label: 'Warning' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
          />
          <div className="search-box">
            <Search size={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs" aria-label="Search logs" />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No logs found" hint="Actions across the club are recorded here." />
      ) : (
        <div className="timeline">
          {filtered.map((l) => (
            <div key={l.id} className={`log-item tag-${l.tag.toLowerCase()}`}>
              <span className="log-dot" aria-hidden />
              <div className="log-body">
                <div className="log-meta">
                  <Badge kind={TAG_KIND[l.tag] ?? 'muted'}>{l.tag}</Badge>
                  <span className="muted small">{formatDateTime(l.createdAt)}</span>
                  {l.mode && <span className="muted small">· {modeBadge(l.mode)}</span>}
                  {l.amount != null && <span className="money-green small">· {formatCurrency(l.amount)}</span>}
                </div>
                <div className="log-msg">{l.message}</div>
                {l.note && <div className="muted small">{l.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
