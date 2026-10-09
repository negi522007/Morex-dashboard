import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { setAuthLang, useAuthLang } from '../lib/authLang'
import { LANGS, type Lang } from '../lib/i18n'
import type { User } from '../lib/types'
import { avatarSrc } from '../components/morex/Chrome'
import { AdminOverview } from '../components/admin/AdminOverview'
import { AdminAccounts } from '../components/admin/AdminAccounts'
import { AdminServices } from '../components/admin/AdminServices'
import { AdminModeration } from '../components/admin/AdminModeration'
import { TEXTS, fullName, type AdminUser, type DialogKind, type Filter, type Section, type ServiceStat } from '../components/admin/shared'
import '../styles/admin.css'

// Admin console (FRONTEND.md § "Admin console"), one page per section under /admin/:section, with a
// fixed sidebar. Data: GET /admin/users and GET /admin/service-stats; actions: PATCH /admin/users/:id
// (rename, confirm email), PATCH …/ban and …/unban, DELETE /admin/users/:id (a reason is required
// for ban and delete, the backend emails it to the user).

const SECTIONS: Section[] = ['overview', 'accounts', 'services', 'moderation']
const ICONS: Record<Section, React.ReactNode> = {
  overview: <><circle cx="12" cy="12" r="3.2" fill="currentColor" /><ellipse cx="12" cy="12" rx="9.5" ry="3.6" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(-20 12 12)" /></>,
  accounts: <><circle cx="7" cy="8" r="2" fill="currentColor" /><circle cx="17" cy="7" r="1.6" fill="currentColor" /><circle cx="13" cy="16" r="2.2" fill="currentColor" /><circle cx="5" cy="17" r="1.3" fill="currentColor" /><path d="M7 8 17 7 13 16 5 17 7 8" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" /></>,
  services: <><circle cx="12" cy="12" r="2.6" fill="currentColor" /><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" opacity=".5" /><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" opacity=".35" /><circle cx="18" cy="12" r="1.5" fill="currentColor" /><circle cx="5.5" cy="7" r="1.3" fill="currentColor" /></>,
  moderation: <><path d="M12 2.5 19.5 5.5v6c0 4.6-3.2 8.3-7.5 10-4.3-1.7-7.5-5.4-7.5-10v-6Z" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m12 7.5 1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3Z" fill="currentColor" /></>,
}

interface Dialog { kind: DialogKind; targets: AdminUser[] }

export function AdminPage() {
  const navigate = useNavigate()
  const { section: raw } = useParams()
  const section: Section = SECTIONS.includes(raw as Section) ? (raw as Section) : 'overview'
  const authLang = useAuthLang()
  const [me, setMe] = useState<User | null>(null)
  const lang: Lang = me && LANGS.includes(me.language as Lang) ? (me.language as Lang) : authLang
  const t = TEXTS[lang]
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [services, setServices] = useState<ServiceStat[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  const [names, setNames] = useState({ firstName: '', lastName: '' })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null)
  // Folded sidebar (icons only), remembered for the next visit like a per-viewer preference
  const [folded, setFolded] = useState(() => { try { return localStorage.getItem('morex.admin.folded') === '1' } catch { return false } })
  const toggleFold = () => setFolded((f) => { try { localStorage.setItem('morex.admin.folded', f ? '0' : '1') } catch { /* not remembered */ } return !f })

  const say = useCallback((text: string, bad = false) => {
    setToast({ text, bad })
    window.setTimeout(() => setToast((cur) => (cur?.text === text ? null : cur)), 3500)
  }, [])
  const load = useCallback(() => Promise.all([
    api.get<AdminUser[]>('/admin/users').then(setUsers),
    api.get<ServiceStat[]>('/admin/service-stats').then(setServices),
  ]).catch((e) => say(e instanceof ApiError ? e.message : TEXTS[lang].error, true)), [lang, say])

  useEffect(() => {
    api.get<User>('/auth/me').then((u) => {
      if (!u.isAdmin) { navigate('/dashboard', { replace: true }); return }
      setMe(u)
    }).catch(() => navigate('/login', { replace: true }))
  }, [navigate])
  // Loaded on arrival, then refreshed every 30 s so changes made elsewhere (a new sign-up, an avatar
  // edited on the dashboard, a widget failing) show up without reloading the page
  useEffect(() => {
    if (!me) return
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Same page look as the dashboard: the account's own theme picture behind everything
  useEffect(() => {
    document.body.classList.add('morex')
    return () => { document.body.classList.remove('morex'); delete document.body.dataset.theme }
  }, [])
  useEffect(() => { if (me) document.body.dataset.theme = me.theme }, [me])
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setDialog(null); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])

  // Same as the dashboard's language menu: saved on the account, and remembered for the login page
  const changeLang = (l: Lang) => {
    setMe((u) => (u ? { ...u, language: l } : u))
    setAuthLang(l)
    api.patch('/auth/me', { language: l }).catch(() => {})
  }
  const go = (s: Section, f?: Filter) => { if (f) setFilter(f); navigate(s === 'overview' ? '/admin' : `/admin/${s}`); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const open = (kind: DialogKind, u: AdminUser) => { setDialog({ kind, targets: [u] }); setReason(''); setTyped(''); setNames({ firstName: u.firstName ?? '', lastName: u.lastName ?? '' }) }

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true)
    try { await fn(); say(done); setDialog(null) } catch (e) { say(e instanceof ApiError ? e.message : t.error, true) } finally { setBusy(false); load() }
  }
  const confirmEmails = (us: AdminUser[]) => run(() => Promise.all(us.map((u) => api.patch(`/admin/users/${u.id}`, { emailVerified: true }))), t.done.confirm)
  function submit() {
    if (!dialog) return
    const { kind, targets } = dialog, r = reason.trim()
    if (kind === 'ban') run(() => Promise.all(targets.map((u) => api.patch(`/admin/users/${u.id}/ban`, { reason: r }))), t.done.ban)
    if (kind === 'unban') run(() => api.patch(`/admin/users/${targets[0].id}/unban`, {}), t.done.unban)
    if (kind === 'delete') run(() => api.del(`/admin/users/${targets[0].id}`, { reason: r }), t.done.delete)
    if (kind === 'rename') run(() => api.patch(`/admin/users/${targets[0].id}`, { firstName: names.firstName, lastName: names.lastName }), t.done.rename)
  }

  if (!me) return <div className="adm-loading">{t.loading}</div>

  const target = dialog?.targets[0]
  const canSubmit = !busy && dialog && (
    dialog.kind === 'unban' ||
    (dialog.kind === 'ban' && !!reason.trim()) ||
    (dialog.kind === 'delete' && !!reason.trim() && typed.trim().toLowerCase() === target?.email.toLowerCase()) ||
    (dialog.kind === 'rename' && !!names.firstName.trim() && !!names.lastName.trim()))

  return (
    <div className={`adm${folded ? ' folded' : ''}`}>
      <aside className="adm-glass adm-side">
        <div className="adm-brand">
          <img src="/logo.svg" alt="" />
          <span className="adm-label-txt">Morex<small>{t.brand}</small></span>
          <button className="adm-fold" onClick={toggleFold} aria-label="Menu" title="Menu"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        </div>
        {SECTIONS.map((s) => (
          <button key={s} className={section === s ? 'on' : ''} onClick={() => go(s)} title={t.nav[s]}>
            <span><svg viewBox="0 0 24 24">{ICONS[s]}</svg><span className="adm-label-txt">{t.nav[s]}</span></span>
          </button>
        ))}
        <div className="adm-me"><img src={avatarSrc(me)} alt="" /><div className="adm-label-txt"><b>{me.firstName || me.email}</b><small>{t.role}</small></div></div>
        <a className="adm-back" href="/dashboard" title={t.back} onClick={(e) => { e.preventDefault(); navigate('/dashboard') }}><span aria-hidden>←</span><span className="adm-label-txt">{t.back.replace(/^←\s*/, '')}</span></a>
      </aside>

      <main className="adm-main">
        <div className="adm-crumb">
          <div className="adm-langs" role="group" aria-label="Language">
            {LANGS.map((l) => <button key={l} className={lang === l ? 'on' : ''} onClick={() => changeLang(l)}>{l.toUpperCase()}</button>)}
          </div>
        </div>
        {!users ? <div className="adm-glass adm-card adm-empty">{t.loading}</div> : (
          <div className="adm-page" key={section}>
            {section === 'overview' && <AdminOverview me={me} users={users} services={services} t={t} lang={lang} go={go} />}
            {section === 'accounts' && <AdminAccounts meId={me.id} users={users} t={t} lang={lang} filter={filter} setFilter={setFilter} busy={busy} open={open} confirmEmails={confirmEmails} />}
            {section === 'services' && <AdminServices services={services} t={t} lang={lang} />}
            {section === 'moderation' && <AdminModeration meId={me.id} users={users} t={t} busy={busy} open={open} confirmEmails={confirmEmails} />}
          </div>
        )}
      </main>

      {dialog && target && (
        <div className="adm-dlg" onClick={(e) => e.target === e.currentTarget && setDialog(null)}>
          <div className="adm-glass adm-dlg-box" role="dialog" aria-modal="true">
            <h3>{dialog.kind === 'ban' ? (dialog.targets.length > 1 ? t.dBanMany(dialog.targets.length) : t.dBan(fullName(target)))
              : dialog.kind === 'unban' ? t.dUnban(fullName(target)) : dialog.kind === 'delete' ? t.dDelete(fullName(target)) : t.dRename(fullName(target))}</h3>
            {dialog.kind !== 'rename' && <p className="adm-muted">{dialog.kind === 'ban' ? t.dBanWhat : dialog.kind === 'unban' ? t.dUnbanWhat : t.dDeleteWhat}</p>}
            {(dialog.kind === 'ban' || dialog.kind === 'delete') && (
              <>
                <label className="adm-label">{t.reason}</label>
                <div className="adm-presets">{t.presets.map((p) => <button key={p} className={`adm-chip ${reason === p ? 'on' : ''}`} onClick={() => setReason(p)}>{p}</button>)}</div>
                <textarea className="adm-input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
                {reason.trim() && <div className="adm-mail"><small>✉ {t.preview}</small>{dialog.kind === 'ban' ? t.mailBan(reason.trim()) : t.mailDelete(reason.trim())}</div>}
              </>
            )}
            {dialog.kind === 'delete' && <><label className="adm-label">{t.typeEmail(target.email)}</label><input className="adm-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={target.email} /></>}
            {dialog.kind === 'rename' && (
              <div className="adm-names">
                <label><span className="adm-label">{t.firstName}</span><input className="adm-input" value={names.firstName} onChange={(e) => setNames((n) => ({ ...n, firstName: e.target.value }))} autoFocus /></label>
                <label><span className="adm-label">{t.lastName}</span><input className="adm-input" value={names.lastName} onChange={(e) => setNames((n) => ({ ...n, lastName: e.target.value }))} /></label>
              </div>
            )}
            <div className="adm-dlg-acts">
              <button className="adm-btn" onClick={() => setDialog(null)}>{t.cancel}</button>
              <button className={`adm-btn ${dialog.kind === 'ban' || dialog.kind === 'delete' ? 'red' : 'primary'}`} disabled={!canSubmit} onClick={submit}>
                {dialog.kind === 'rename' ? t.save : t.go}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`adm-toast ${toast.bad ? 'bad' : ''}`}>{toast.text}</div>}
    </div>
  )
}
