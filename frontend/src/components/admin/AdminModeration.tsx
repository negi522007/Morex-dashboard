import { UserAvatar, fullName, hoursLeft, isLocked, type AdminTexts, type AdminUser, type DialogKind } from './shared'

// Green with plenty of time left, amber under 12 h, red under 3 h
const timeColor = (h: number) => (h <= 3 ? '#f87171' : h <= 12 ? '#fbbf24' : '#34d399')
const C = 2 * Math.PI * 27

// Ring that empties as the 24 h before the server deletes an unconfirmed account run out
function Hourglass({ h, t }: { h: number; t: AdminTexts }) {
  const c = timeColor(h)
  return (
    <span className="adm-hourglass">
      <svg viewBox="0 0 62 62">
        <circle cx="31" cy="31" r="27" fill="none" stroke="rgb(255 255 255 / .1)" strokeWidth="6" />
        <circle cx="31" cy="31" r="27" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(Math.min(24, h) / 24) * C} ${C}`} transform="rotate(-90 31 31)" style={{ filter: `drop-shadow(0 0 6px ${c})` }} />
      </svg>
      <span>{h} h<small>{t.hoursLeftShort}</small></span>
    </span>
  )
}

// "Modération": three key numbers, then the unconfirmed accounts (most urgent first, each with the time
// left before the server deletes it) and the suspended accounts with the reason they were given.
export function AdminModeration({ meId, users, t, busy, open, confirmEmails }: {
  meId: string; users: AdminUser[]; t: AdminTexts; busy: boolean
  open: (kind: DialogKind, u: AdminUser) => void; confirmEmails: (us: AdminUser[]) => void
}) {
  const unconfirmed = users.filter((u) => !u.emailVerified).sort((a, b) => hoursLeft(a) - hoursLeft(b))
  const banned = users.filter((u) => u.isBanned)
  const urgent = unconfirmed.filter((u) => hoursLeft(u) <= 3).length
  return (
    <>
      <div className="adm-svc-sum adm-mod-sum">
        <div style={{ '--k': '#f87171' } as React.CSSProperties}><b>{urgent}</b><span>{t.modUrgent(urgent)}</span></div>
        <div style={{ '--k': '#fbbf24' } as React.CSSProperties}><b>{unconfirmed.length}</b><span>{t.modToConfirm}</span></div>
        <div style={{ '--k': '#a78bfa' } as React.CSSProperties}><b>{banned.length}</b><span>{t.modSuspended}</span></div>
      </div>
      <div className="adm-row adm-r2 adm-even">
        <div className="adm-glass adm-card">
          <h3>{t.expiring}</h3>
          <p className="adm-muted adm-note">{t.expiringNote}</p>
          {unconfirmed.length ? unconfirmed.map((u) => (
            <div key={u.id} className="adm-task">
              <Hourglass h={hoursLeft(u)} t={t} />
              <UserAvatar u={u} size={48} />
              <div className="adm-grow"><b>{fullName(u)}</b><small>{u.email}</small></div>
              <button className="adm-btn sm" disabled={busy} onClick={() => confirmEmails([u])}>{t.confirm}</button>
            </div>
          )) : <div className="adm-empty">{t.nothingToConfirm}</div>}
        </div>
        <div className="adm-glass adm-card">
          <h3>{t.suspended}</h3>
          <p className="adm-muted adm-note">{t.suspendedNote}</p>
          {banned.length ? banned.map((u) => (
            <div key={u.id} className="adm-task">
              <UserAvatar u={u} size={48} />
              <div className="adm-grow"><b>{fullName(u)}</b><small>{u.email}</small>{u.banReason && <div className="adm-reason">« {u.banReason} »</div>}</div>
              <button className="adm-btn sm" disabled={isLocked(u, meId)} onClick={() => open('unban', u)}>{t.unban}</button>
              <button className="adm-btn sm danger" disabled={isLocked(u, meId)} onClick={() => open('delete', u)}>{t.del}</button>
            </div>
          )) : <div className="adm-empty">{t.nobodySuspended}</div>}
        </div>
      </div>
    </>
  )
}
