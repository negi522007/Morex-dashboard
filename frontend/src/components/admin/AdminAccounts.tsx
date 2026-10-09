import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Lang } from '../../lib/i18n'
import { ago } from '../../lib/format'
import { ZODIAC } from '../../lib/catalog'
import { StatusBadges } from './AdminOverview'
import { DashboardPreview } from './DashboardPreview'
import { LinkedChips, UserAvatar, downloadCsv, fold, fullName, hoursLeft, isLocked, type AdminTexts, type AdminUser, type DialogKind, type Filter, type SessionInfo } from './shared'

const DAY = 86_400_000
const statusColor = (u: AdminUser) => (u.isBanned ? '#f87171' : !u.emailVerified ? '#fbbf24' : u.isAdmin ? '#a78bfa' : '#34d399')

// "Comptes": the list on the left (search, status filter, newest first, ↑ / ↓ to move), the selected
// account's sheet on the right with everything the server knows about it and its actions.
export function AdminAccounts({ meId, users, t, lang, filter, setFilter, busy, open, confirmEmails }: {
  meId: string; users: AdminUser[]; t: AdminTexts; lang: Lang; filter: Filter; setFilter: (f: Filter) => void; busy: boolean
  open: (kind: DialogKind, u: AdminUser) => void; confirmEmails: (us: AdminUser[]) => void
}) {
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<string | null>(null)

  const counts: Record<Filter, number> = {
    all: users.length, unconfirmed: users.filter((u) => !u.emailVerified).length,
    banned: users.filter((u) => u.isBanned).length, admins: users.filter((u) => u.isAdmin).length,
  }
  const rows = useMemo(() => {
    const needle = fold(q.trim())
    return users
      .filter((u) => (filter === 'unconfirmed' ? !u.emailVerified : filter === 'banned' ? u.isBanned : filter === 'admins' ? u.isAdmin : true))
      .filter((u) => !needle || fold(`${fullName(u)} ${u.email}`).includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [users, filter, q])
  // The clicked account while it is still in the list, else the first one
  const sel = rows.find((u) => u.id === selId) ?? rows[0] ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!rows.length || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
      if ((e.target as HTMLElement).closest('input, textarea, [role="dialog"]')) return
      e.preventDefault()
      const i = Math.max(0, rows.findIndex((u) => u.id === sel?.id))
      setSelId(rows[(i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length].id)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [rows, sel?.id])

  return (
    <>
      <div className="adm-tools">
        {(['all', 'unconfirmed', 'banned', 'admins'] as Filter[]).map((f) => (
          <button key={f} className={`adm-chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {{ all: t.fAll, unconfirmed: t.fUnconf, banned: t.fBanned, admins: t.fAdmins }[f]} <b>{counts[f]}</b>
          </button>
        ))}
        <button className="adm-btn" onClick={() => downloadCsv(rows)}>{t.csv}</button>
        <SearchBox value={q} onChange={setQ} placeholder={t.search} />
      </div>

      {!rows.length ? <div className="adm-glass adm-card adm-empty">{t.none}</div> : (
        <div className="adm-md">
          <div className="adm-glass adm-list">
            {rows.map((u) => (
              <button key={u.id} className={`adm-li ${sel?.id === u.id ? 'on' : ''}`} onClick={() => setSelId(u.id)}>
                <span className="adm-li-av"><UserAvatar u={u} size={46} /><i style={{ background: statusColor(u) }} /></span>
                <span className="adm-grow"><b>{fullName(u)}{u.id === meId && <span className="adm-muted"> {t.you}</span>}</b><small>{u.email}</small></span>
                <span className="adm-li-w"><b>{u.widgetCount}</b>{t.cWidgets.toLowerCase()}</span>
              </button>
            ))}
            <div className="adm-kbd"><i>↑</i><i>↓</i> {t.kbdHint}</div>
          </div>
          {sel && <Sheet key={sel.id} u={sel} meId={meId} t={t} lang={lang} busy={busy} open={open} confirmEmails={confirmEmails} />}
        </div>
      )}
    </>
  )
}

function Sheet({ u, meId, t, lang, busy, open, confirmEmails }: {
  u: AdminUser; meId: string; t: AdminTexts; lang: Lang; busy: boolean
  open: (kind: DialogKind, u: AdminUser) => void; confirmEmails: (us: AdminUser[]) => void
}) {
  const locked = isLocked(u, meId), lockTip = u.id === meId ? t.lockedSelf : t.lockedAdmin
  const days = Math.max(0, Math.floor((Date.now() - new Date(u.createdAt).getTime()) / DAY))
  const long = (iso: string) => new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })
  const c = statusColor(u)
  return (
    <div className="adm-glass adm-sheet" style={{ '--c': c } as React.CSSProperties}>
      <div className="adm-sheet-orb" aria-hidden="true" />
      <div className="adm-sheet-id">
        <span className="adm-sheet-av"><UserAvatar u={u} size={124} /></span>
        <div className="adm-grow">
          <h3>{fullName(u)}{u.id === meId && <span className="adm-muted"> {t.you}</span>}</h3>
          <p>{u.email}</p>
          <div className="adm-sheet-badges">
            <StatusBadges u={u} t={t} />
            {!u.emailVerified && <span className="adm-badge unconf">⏳ {t.expires(hoursLeft(u))}</span>}
            <span className="adm-muted">{t.seenLine(u.lastSeenAt ? ago(u.lastSeenAt, lang) : t.never)}</span>
          </div>
        </div>
      </div>

      <div className="adm-kv">
        <div style={{ '--k': '#a78bfa' } as React.CSSProperties}><b>{u.widgetCount}</b><span>{t.cWidgets}</span></div>
        <div style={{ '--k': '#f472b6' } as React.CSSProperties} className="adm-kv-links"><span className="adm-kv-row">{(u.linkedAccounts ?? []).length > 0 ? <LinkedChips u={u} t={t} names={false} /> : <b>0</b>}</span><span>{t.cLinks}</span></div>
        <div style={{ '--k': '#38bdf8' } as React.CSSProperties}><b>{u.sessionCount}</b><span>{t.cSessions}</span></div>
        <div style={{ '--k': '#34d399' } as React.CSSProperties}><b>{days}</b><span>{t.daysOn}</span></div>
      </div>

      <div className="adm-sheet-cols">
        <div className="adm-lines">
          <div><span>{t.joinedOn}</span><b>{long(u.createdAt)}</b></div>
          <div><span>{t.birthLine}</span><b>{birth(u, t, lang)}</b></div>
          <div><span>{t.lastLogin}</span><b>{u.lastLoginAt ? ago(u.lastLoginAt, lang) : t.never}</b></div>
          <div><span>{t.emailLine}</span><b>{u.emailVerified ? t.emailOk : t.emailWait}</b></div>
          <div><span>{t.roleLine}</span><b>{u.isAdmin ? t.roleAdmin : t.roleUser}</b></div>
          {(u.linkedAccounts ?? []).length > 0 && <div><span>{t.cLinks}</span><LinkedChips u={u} t={t} /></div>}
          {u.isBanned && u.banReason && <div><span>{t.banReasonLine}</span><span className="adm-reason">« {u.banReason} »</span></div>}
        </div>
        <Sessions u={u} t={t} lang={lang} />
      </div>

      <DashboardPreview u={u} t={t} lang={lang} />

      <div className="adm-sheet-acts">
        <button className="adm-btn" onClick={() => open('rename', u)}>{t.rename}</button>
        {!u.emailVerified && <button className="adm-btn" disabled={busy} onClick={() => confirmEmails([u])}>{t.confirm}</button>}
        <button className="adm-btn" onClick={() => downloadCsv([u])}>{t.bulkCsv}</button>
        <span className="adm-sheet-danger">
          {u.isBanned
            ? <button className="adm-btn" disabled={locked} title={locked ? lockTip : undefined} onClick={() => open('unban', u)}>{t.unban}</button>
            : <button className="adm-btn danger" disabled={locked} title={locked ? lockTip : undefined} onClick={() => open('ban', u)}>{t.ban}</button>}
          <button className="adm-btn danger" disabled={locked} title={locked ? lockTip : undefined} onClick={() => open('delete', u)}>{t.del}</button>
        </span>
      </div>
    </div>
  )
}

// The account's open sessions (GET /admin/users/:id/sessions), each named by browser and system
function Sessions({ u, t, lang }: { u: AdminUser; t: AdminTexts; lang: Lang }) {
  const [list, setList] = useState<SessionInfo[] | null>(null)
  useEffect(() => {
    let alive = true
    api.get<SessionInfo[]>(`/admin/users/${u.id}/sessions`).then((l) => alive && setList(l)).catch(() => alive && setList([]))
    return () => { alive = false }
  }, [u.id])
  const device = (s: SessionInfo) => (s.browser === 'Unknown' && s.os === 'Unknown' ? t.unknownDevice : [s.browser, s.os].filter((x) => x !== 'Unknown').join(' · '))
  return (
    <div className="adm-sessions">
      <div className="adm-sessions-title">{t.openSessions}</div>
      {!list ? <div className="adm-muted">…</div> : !list.length ? <div className="adm-muted">{t.noSessions}</div> : list.map((s, i) => (
        <div key={i} className="adm-session">
          <span className="adm-session-ic" aria-hidden="true">{s.os === 'iOS' || s.os === 'Android' ? '📱' : '💻'}</span>
          <span className="adm-grow"><b>{device(s)}</b><small>{t.sessionSince(ago(s.createdAt, lang), ago(s.lastSeenAt, lang))}</small></span>
        </div>
      ))}
    </div>
  )
}

// "12 avril 2000 · 26 ans · ♈ Bélier", read as a plain calendar date (no time zone shift)
function birth(u: AdminUser, t: AdminTexts, lang: Lang) {
  if (!u.birthDate) return t.birthNone
  const [y, m, d] = u.birthDate.split('-').map(Number), now = new Date()
  const age = now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0)
  const sign = u.zodiac ? ZODIAC[u.zodiac] : null
  return [new Date(y, m - 1, d).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }), t.age(age), sign && `${sign.glyph} ${sign.name[lang]}`].filter(Boolean).join(' · ')
}

// A round lens that unrolls into a search field when clicked, and folds back when left empty
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const unfolded = open || !!value
  return (
    <div className={`adm-find ${unfolded ? 'open' : ''}`}>
      <button className="adm-find-lens" aria-label={placeholder} onClick={() => { setOpen(true); input.current?.focus() }}>
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>
      <input ref={input} value={value} placeholder={placeholder} tabIndex={unfolded ? 0 : -1}
        onChange={(e) => onChange(e.target.value)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') { onChange(''); setOpen(false); input.current?.blur() } }} />
    </div>
  )
}
