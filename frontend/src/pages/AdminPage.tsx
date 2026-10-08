import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { useAuthLang } from '../lib/authLang'
import { ago } from '../lib/format'
import type { Lang } from '../lib/i18n'
import type { User } from '../lib/types'

// Admin console (FRONTEND.md § "Admin console"): the one screen the backend's AdminModule never had.
// Not required by the brief, built anyway — see README.md.

interface AdminUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  emailVerified: boolean
  isAdmin: boolean
  isBanned: boolean
  createdAt: string
  widgetCount: number
  linkedAccountsCount: number
  sessionCount: number
}

const T = {
  fr: {
    title: 'Administration', back: '← Retour au dashboard', search: 'Rechercher un nom ou un email…',
    all: 'Tous', unconfirmed: 'Non confirmés', banned: 'Bannis', none: 'Aucun utilisateur',
    colName: 'Nom', colEmail: 'Email', colStatus: 'Statut', colJoined: 'Inscrit', colCounts: 'Widgets / Comptes liés / Sessions',
    colActions: 'Actions', badgeUnconfirmed: 'Non confirmé', badgeBanned: 'Banni', badgeAdmin: 'Admin',
    unconfirmedTip: 'Les comptes non confirmés sont supprimés automatiquement après 24 h',
    edit: 'Modifier', save: 'Enregistrer', cancel: 'Annuler', confirmEmail: 'Confirmer l’email',
    ban: 'Bannir', unban: 'Réactiver', delete: 'Supprimer',
    confirmBan: (n: string) => `Bannir ${n} ? Ses sessions seront fermées immédiatement.`,
    confirmUnban: (n: string) => `Réactiver ${n} ?`,
    deletePrompt: (e: string) => `Suppression définitive. Tape l’email pour confirmer : ${e}`,
    deleteWarn: 'Widgets, journal, comptes liés — tout part avec, pour de bon.',
    confirm: 'Confirmer', loading: 'Chargement…', error: 'Une erreur est survenue', firstName: 'Prénom', lastName: 'Nom',
  },
  en: {
    title: 'Admin', back: '← Back to dashboard', search: 'Search a name or email…',
    all: 'All', unconfirmed: 'Unconfirmed', banned: 'Banned', none: 'No users',
    colName: 'Name', colEmail: 'Email', colStatus: 'Status', colJoined: 'Joined', colCounts: 'Widgets / Linked accounts / Sessions',
    colActions: 'Actions', badgeUnconfirmed: 'Unconfirmed', badgeBanned: 'Banned', badgeAdmin: 'Admin',
    unconfirmedTip: 'Unconfirmed accounts are deleted automatically after 24 h',
    edit: 'Edit', save: 'Save', cancel: 'Cancel', confirmEmail: 'Confirm email',
    ban: 'Ban', unban: 'Unban', delete: 'Delete',
    confirmBan: (n: string) => `Ban ${n}? Their sessions will end immediately.`,
    confirmUnban: (n: string) => `Unban ${n}?`,
    deletePrompt: (e: string) => `Permanent deletion. Type the email to confirm: ${e}`,
    deleteWarn: 'Widgets, journal, linked accounts — all of it goes too, for good.',
    confirm: 'Confirm', loading: 'Loading…', error: 'Something went wrong', firstName: 'First name', lastName: 'Last name',
  },
  es: {
    title: 'Administración', back: '← Volver al panel', search: 'Buscar un nombre o email…',
    all: 'Todos', unconfirmed: 'No confirmados', banned: 'Suspendidos', none: 'Sin usuarios',
    colName: 'Nombre', colEmail: 'Email', colStatus: 'Estado', colJoined: 'Registrado', colCounts: 'Widgets / Cuentas vinculadas / Sesiones',
    colActions: 'Acciones', badgeUnconfirmed: 'No confirmado', badgeBanned: 'Suspendido', badgeAdmin: 'Admin',
    unconfirmedTip: 'Las cuentas no confirmadas se eliminan automáticamente tras 24 h',
    edit: 'Editar', save: 'Guardar', cancel: 'Cancelar', confirmEmail: 'Confirmar email',
    ban: 'Suspender', unban: 'Reactivar', delete: 'Eliminar',
    confirmBan: (n: string) => `¿Suspender a ${n}? Sus sesiones terminarán de inmediato.`,
    confirmUnban: (n: string) => `¿Reactivar a ${n}?`,
    deletePrompt: (e: string) => `Eliminación definitiva. Escribe el email para confirmar: ${e}`,
    deleteWarn: 'Widgets, diario, cuentas vinculadas: todo desaparece, para siempre.',
    confirm: 'Confirmar', loading: 'Cargando…', error: 'Algo salió mal', firstName: 'Nombre', lastName: 'Apellido',
  },
} satisfies Record<Lang, Record<string, string | ((s: string) => string)>>

function fold(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function AdminPage() {
  const navigate = useNavigate()
  const lang = useAuthLang()
  const t = T[lang] as (typeof T)['en']
  const [me, setMe] = useState<User | null>(null)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'unconfirmed' | 'banned'>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({ firstName: '', lastName: '' })
  const [confirming, setConfirming] = useState<{ id: string; kind: 'ban' | 'unban' | 'delete' } | null>(null)
  const [deleteTyped, setDeleteTyped] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => api.get<AdminUser[]>('/admin/users').then(setUsers).catch((e) => setError(e instanceof ApiError ? e.message : t.error))

  useEffect(() => {
    api.get<User>('/auth/me').then((u) => {
      setMe(u)
      if (!u.isAdmin) { navigate('/dashboard', { replace: true }); return }
      load()
    }).catch(() => navigate('/login', { replace: true }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const needle = fold(q.trim())
  const filtered = useMemo(() => {
    if (!users) return []
    return users
      .filter((u) => (filter === 'unconfirmed' ? !u.emailVerified : filter === 'banned' ? u.isBanned : true))
      .filter((u) => !needle || fold(`${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email}`).includes(needle))
  }, [users, filter, needle])

  async function act<T>(id: string, fn: () => Promise<T>) {
    setBusy(id); setError('')
    try { await fn(); await load() } catch (e) { setError(e instanceof ApiError ? e.message : t.error) } finally { setBusy(null); setConfirming(null); setDeleteTyped('') }
  }

  const name = (u: AdminUser) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email

  if (!me) return <div className="min-h-screen bg-slate-950 px-4 py-10 font-sans text-white">{t.loading}</div>

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 font-sans text-white">
      <main className="mx-auto max-w-6xl">
        <a href="/dashboard" onClick={(e) => { e.preventDefault(); navigate('/dashboard') }} className="text-sm text-white/60 underline decoration-white/30 hover:text-white">{t.back}</a>
        <h1 className="mt-4 mb-6 text-3xl font-bold">{t.title}</h1>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search}
            className="min-w-[240px] flex-1 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm text-white placeholder-white/50 focus:border-white/50 focus:outline-none" />
          <div className="flex gap-1 rounded-full border border-white/15 bg-white/5 p-1">
            {(['all', 'unconfirmed', 'banned'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === f ? 'bg-white text-slate-950' : 'text-white/70 hover:text-white'}`}>
                {f === 'all' ? t.all : f === 'unconfirmed' ? t.unconfirmed : t.banned}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-500/15 px-4 py-2.5 text-sm text-red-200">{error}</p>}

        {!users ? (
          <p className="text-white/60">{t.loading}</p>
        ) : filtered.length === 0 ? (
          <p className="text-white/50">{t.none}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-4 py-3 font-medium">{t.colName}</th>
                  <th className="px-4 py-3 font-medium">{t.colEmail}</th>
                  <th className="px-4 py-3 font-medium">{t.colStatus}</th>
                  <th className="px-4 py-3 font-medium">{t.colJoined}</th>
                  <th className="px-4 py-3 font-medium">{t.colCounts}</th>
                  <th className="px-4 py-3 font-medium">{t.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === me.id
                  const locked = isSelf || u.isAdmin // can't ban/delete yourself or another admin
                  return (
                    <tr key={u.id} className="border-t border-white/10 align-top">
                      <td className="px-4 py-3">
                        {editing === u.id ? (
                          <div className="flex flex-col gap-1.5">
                            <input value={editValues.firstName} onChange={(e) => setEditValues((v) => ({ ...v, firstName: e.target.value }))}
                              placeholder={t.firstName} className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm" />
                            <input value={editValues.lastName} onChange={(e) => setEditValues((v) => ({ ...v, lastName: e.target.value }))}
                              placeholder={t.lastName} className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm" />
                            <div className="flex gap-2">
                              <button onClick={() => act(u.id, () => api.patch(`/admin/users/${u.id}`, editValues))} disabled={busy === u.id}
                                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">{t.save}</button>
                              <button onClick={() => setEditing(null)} className="rounded-full border border-white/25 px-3 py-1 text-xs">{t.cancel}</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setEditing(u.id); setEditValues({ firstName: u.firstName ?? '', lastName: u.lastName ?? '' }) }}
                            className="text-left hover:underline">{name(u)}</button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/80">{u.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {!u.emailVerified && <span title={t.unconfirmedTip} className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">{t.badgeUnconfirmed}</span>}
                          {u.isBanned && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-200">{t.badgeBanned}</span>}
                          {u.isAdmin && <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-200">{t.badgeAdmin}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/70">{ago(u.createdAt, lang)}</td>
                      <td className="px-4 py-3 text-white/70">{u.widgetCount} / {u.linkedAccountsCount} / {u.sessionCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {!u.emailVerified && (
                            <button disabled={busy === u.id} onClick={() => act(u.id, () => api.patch(`/admin/users/${u.id}`, { emailVerified: true }))}
                              className="rounded-full border border-white/20 px-2.5 py-1 text-xs hover:bg-white/10">{t.confirmEmail}</button>
                          )}
                          {!locked && confirming?.id === u.id && confirming.kind === (u.isBanned ? 'unban' : 'ban') ? (
                            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-xs">
                              {u.isBanned ? t.confirmUnban(name(u)) : t.confirmBan(name(u))}
                              <button disabled={busy === u.id} onClick={() => act(u.id, () => api.patch(`/admin/users/${u.id}/${u.isBanned ? 'unban' : 'ban'}`, {}))} className="font-semibold underline">{t.confirm}</button>
                              <button onClick={() => setConfirming(null)}>{t.cancel}</button>
                            </span>
                          ) : !locked ? (
                            <button onClick={() => setConfirming({ id: u.id, kind: u.isBanned ? 'unban' : 'ban' })}
                              className="rounded-full border border-white/20 px-2.5 py-1 text-xs hover:bg-white/10">{u.isBanned ? t.unban : t.ban}</button>
                          ) : null}
                          {!locked && confirming?.id === u.id && confirming.kind === 'delete' ? (
                            <span className="flex flex-col gap-1 rounded-xl bg-red-500/10 p-2 text-xs">
                              <span>{t.deletePrompt(u.email)}</span>
                              <span className="text-red-200/80">{t.deleteWarn}</span>
                              <input value={deleteTyped} onChange={(e) => setDeleteTyped(e.target.value)} placeholder={u.email}
                                className="rounded-lg border border-white/20 bg-white/10 px-2 py-1" />
                              <span className="flex gap-2">
                                <button disabled={busy === u.id || deleteTyped.trim().toLowerCase() !== u.email.toLowerCase()}
                                  onClick={() => act(u.id, () => api.del(`/admin/users/${u.id}`))}
                                  className="rounded-full bg-red-500 px-3 py-1 font-semibold text-white disabled:opacity-40">{t.confirm}</button>
                                <button onClick={() => { setConfirming(null); setDeleteTyped('') }} className="rounded-full border border-white/25 px-3 py-1">{t.cancel}</button>
                              </span>
                            </span>
                          ) : !locked ? (
                            <button onClick={() => setConfirming({ id: u.id, kind: 'delete' })}
                              className="rounded-full border border-red-400/40 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10">{t.delete}</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
