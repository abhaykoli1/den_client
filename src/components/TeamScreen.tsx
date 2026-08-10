import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, UserCog } from 'lucide-react'
import { api, asArray } from '../lib/api'
import { useClub } from '../context/ClubContext'
import { formatDateTime } from '../lib/format'
import { Badge, Card, EmptyState, StatCard } from './ui'
import type { TeamClubRow } from '../types'

// ------------------------------------------------------------------ screen

/** Admin-area tab: which person manages which club (masters excluded). */
export default function TeamScreen() {
  const { club } = useClub()
  const [rows, setRows] = useState<TeamClubRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!club) return
    setLoading(true)
    setError(null)
    try {
      const data = await api<TeamClubRow[]>('/team')
      setRows(asArray<TeamClubRow>(data))
    } catch {
      setError('Could not load the team overview')
    } finally {
      setLoading(false)
    }
  }, [club?.id])

  useEffect(() => {
    void load()
  }, [load])

  const totalStaff = rows.reduce((s, r) => s + r.staff.length, 0)
  const disabled = rows.reduce((s, r) => s + r.staff.filter((m) => !m.active).length, 0)

  return (
    <div className="stack">
      {error && <div className="banner banner-error">{error}</div>}

      <div className="grid-stats three">
        <StatCard label="Clubs" tone="blue" value={rows.length} sub="under you" />
        <StatCard label="Handlers" tone="green" value={totalStaff} sub="owners + staff" />
        <StatCard label="Disabled" tone="gold" value={disabled} sub="accounts blocked by Master Admin" />
      </div>

      {rows.length === 0 && !loading ? (
        <Card>
          <EmptyState icon={<UserCog size={26} />} title="No staff yet" hint="When a Master Admin links an account to your club, it will show up here." />
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.club.id}>
            <div className="row spread">
              <div className="section-title" style={{ margin: 0 }}>{row.club.name}</div>
              <Badge kind="muted">{row.staff.length} handler{row.staff.length === 1 ? '' : 's'}</Badge>
            </div>
            <div className="stack-sm" style={{ marginTop: 8 }}>
              {row.staff.map((s) => (
                <div key={s.id} className="team-row">
                  {s.picture ? (
                    <img className="avatar" src={s.picture} alt={s.name} referrerPolicy="no-referrer" />
                  ) : (
                    <span className="avatar avatar-initial">{(s.name || '?').slice(0, 1).toUpperCase()}</span>
                  )}
                  <div className="team-info">
                    <div className="team-name">
                      {s.name}
                      {s.isOwner && (
                        <Badge kind="gold">
                          <ShieldCheck size={10} style={{ verticalAlign: -1 }} /> Owner
                        </Badge>
                      )}
                      {!s.isOwner && <Badge kind="blue">Staff</Badge>}
                      {!s.active && <Badge kind="red">disabled</Badge>}
                    </div>
                    <div className="muted small">{s.email}</div>
                  </div>
                  <div className="team-meta muted small">
                    {s.lastLoginAt ? `last login · ${formatDateTime(s.lastLoginAt)}` : 'never logged in'}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
