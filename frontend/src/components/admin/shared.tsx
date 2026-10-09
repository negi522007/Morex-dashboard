import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../../lib/i18n'
import { avatarUrl, DEFAULT_AVATAR } from '../../lib/avatar'
import { GithubIcon, GoogleIcon, MicrosoftIcon } from '../SsoButtons'

// Shared pieces of the admin console (AdminPage + one component per section): API shapes, texts,
// small derived numbers and the hand-drawn SVG charts. Everything is computed from GET /admin/users
// and GET /admin/service-stats, nothing here is invented.

export interface AdminUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  emailVerified: boolean
  isAdmin: boolean
  isBanned: boolean
  banReason: string | null
  createdAt: string
  avatarConfig: Record<string, string> | null
  avatarPhotoUrl: string | null
  // "YYYY-MM-DD" and its sign, null when the user never gave it
  birthDate: string | null
  zodiac: string | null
  // Last time they opened a session / were active (null if not seen since this was tracked)
  lastLoginAt: string | null
  lastSeenAt: string | null
  widgetCount: number
  linkedAccountsCount: number
  // github / google / microsoft / epitech, with the account's name when the provider gave one
  linkedAccounts: { provider: string; label: string | null }[]
  sessionCount: number
}

// GET /admin/users/:id/sessions: a valid session, named by browser and system (never its id)
export interface SessionInfo { browser: string; os: string; createdAt: string; lastSeenAt: string; expiresAt: string }

export const PROVIDERS: Record<string, { name: string; color: string; short: string }> = {
  github: { name: 'GitHub', color: '#e2e8f0', short: 'GH' },
  google: { name: 'Google', color: '#f87171', short: 'G' },
  microsoft: { name: 'Microsoft', color: '#38bdf8', short: 'MS' },
  epitech: { name: 'Epitech', color: '#60a5fa', short: 'EPI' },
}

export interface ServiceStat {
  service: string
  widgets: number
  users: number
  errors: number
  lastError: string | null
  // Which of the service's widgets are in use, most used first
  types?: { widget: string; count: number }[]
}

export type Section = 'overview' | 'accounts' | 'services' | 'moderation'
export type Filter = 'all' | 'unconfirmed' | 'banned' | 'admins'
export type DialogKind = 'ban' | 'unban' | 'delete' | 'rename'
export type HealthLevel = 'ok' | 'warn' | 'bad'

// Same delay as the backend's unconfirmed-account cleanup (EMAIL_TOKEN_TTL_MS)
const UNCONFIRMED_TTL_H = 24
const DAY = 86_400_000

export const fullName = (u: AdminUser) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
export const hoursLeft = (u: AdminUser) =>
  Math.max(0, Math.ceil(UNCONFIRMED_TTL_H - (Date.now() - new Date(u.createdAt).getTime()) / 3_600_000))
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// The backend refuses to ban or delete yourself or another admin: the buttons follow the same rule
export const isLocked = (u: AdminUser, meId: string) => u.id === meId || u.isAdmin

// The same face the user sees on their own dashboard: uploaded photo first, else their DiceBear options
export const userAvatarSrc = (u: AdminUser) => u.avatarPhotoUrl || avatarUrl({ ...DEFAULT_AVATAR, ...(u.avatarConfig ?? {}) })
export function UserAvatar({ u, size = 44 }: { u: AdminUser; size?: number }) {
  return <img className="adm-av" src={userAvatarSrc(u)} alt="" width={size} height={size} loading="lazy" />
}

// Width of an element in CSS pixels, kept up to date: charts draw at this real width so their text and
// shapes keep a normal size instead of being scaled up with the card on wide screens
export function useWidth<T extends HTMLElement>(fallback = 800) {
  const ref = useRef<T>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

// The provider's own logo (same ones as the sign-in buttons), in a small round badge
export function ProviderIcon({ provider, size = 34 }: { provider: string; size?: number }) {
  const logo = provider === 'github' ? <GithubIcon /> : provider === 'google' ? <GoogleIcon /> : provider === 'microsoft' ? <MicrosoftIcon />
    : <b className="adm-prov-epi">{provider === 'epitech' ? 'EPI' : provider.slice(0, 2).toUpperCase()}</b>
  return <span className={`adm-prov ${provider}`} style={{ width: size, height: size }}>{logo}</span>
}

// Linked accounts as logos, with the account's name next to it when the provider gave one
export function LinkedChips({ u, t, names = true }: { u: AdminUser; t: AdminTexts; names?: boolean }) {
  // ?? []: an older server (not restarted since this field was added) doesn't send it
  const links = u.linkedAccounts ?? []
  if (!links.length) return <span className="adm-muted">{t.noLinks}</span>
  return (
    <span className="adm-links">
      {links.map((a, i) => {
        const name = PROVIDERS[a.provider]?.name ?? a.provider
        return (
          <span key={i} className={names ? 'adm-link' : 'adm-link bare'} title={a.label ? `${name} · ${a.label}` : name}>
            <ProviderIcon provider={a.provider} size={names ? 26 : 34} />{names && <span>{a.label ?? name}</span>}
          </span>
        )
      })}
    </span>
  )
}

export function stats(users: AdminUser[]) {
  const weekAgo = Date.now() - 7 * DAY
  const unconfirmed = users.filter((u) => !u.emailVerified).length
  return {
    all: users.length,
    newThisWeek: users.filter((u) => new Date(u.createdAt).getTime() > weekAgo).length,
    unconfirmed,
    banned: users.filter((u) => u.isBanned).length,
    admins: users.filter((u) => u.isAdmin).length,
    widgets: users.reduce((n, u) => n + u.widgetCount, 0),
    confirmRate: users.length ? Math.round(((users.length - unconfirmed) / users.length) * 100) : 0,
  }
}

// Accounts that existed at the end of each of the last `days` days (deleted ones are gone, so this is
// the growth of the accounts still here)
export function growth(users: AdminUser[], days = 14) {
  const end = new Date(); end.setHours(23, 59, 59, 999)
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(end.getTime() - (days - 1 - i) * DAY)
    return { day, count: users.filter((u) => new Date(u.createdAt) <= day).length }
  })
}

export function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values), min = Math.min(...values), span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`).join(' ')
  return <svg className="adm-spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
}

// Health score shown in the greeting card: starts at 100 and loses points per problem. Urgent = an
// account deleted within 3 h if nobody confirms it, or a service whose widgets all fail.
export function health(users: AdminUser[], services: ServiceStat[]) {
  const pending = users.filter((u) => !u.emailVerified)
  const failing = services.filter((s) => s.errors > 0)
  const banned = users.filter((u) => u.isBanned).length
  const soon = pending.some((u) => hoursLeft(u) <= 3), dead = failing.some((s) => s.errors === s.widgets)
  const score = Math.max(0, 100
    - pending.reduce((n, u) => n + (hoursLeft(u) <= 3 ? 15 : 5), 0)
    - failing.reduce((n, s) => n + (s.errors === s.widgets ? 25 : 8), 0)
    - banned * 2)
  const level: HealthLevel = soon || dead ? 'bad' : pending.length || failing.length || banned ? 'warn' : 'ok'
  return { score, level, pending: pending.length, failing: failing.length, banned }
}

export function downloadCsv(users: AdminUser[]) {
  const head = ['email', 'firstName', 'lastName', 'emailVerified', 'isAdmin', 'isBanned', 'banReason', 'createdAt', 'lastLoginAt', 'lastSeenAt', 'widgetCount', 'linkedAccountsCount', 'sessionCount']
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = users.map((u) => head.map((k) => cell(u[k as keyof AdminUser])).join(','))
  const url = URL.createObjectURL(new Blob([[head.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = `morex-comptes-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

const fr = {
  brand: 'console admin', back: '← Retour au dashboard', role: 'admin', loading: 'Chargement…', error: 'Une erreur est survenue',
  nav: { overview: 'Vue d’ensemble', accounts: 'Comptes', services: 'Services', moderation: 'Modération' } as Record<Section, string>,
  hello: ['Bonjour', 'Bon après-midi', 'Bonsoir'], 
  gauge: { ok: 'Morex est en pleine forme', warn: 'Morex va bien, à surveiller', bad: 'Morex a besoin de toi' } as Record<HealthLevel, string>,
  healthNone: 'aucun problème détecté', healthTip: 'Score de santé sur 100',
  hConfirm: (n: number) => `${n} à confirmer`, hSvc: (n: number) => `${n} service${n > 1 ? 's' : ''} en erreur`, hBan: (n: number) => `${n} suspendu${n > 1 ? 's' : ''}`,
  todoExpire: (n: number) => `${n} compte${n > 1 ? 's vont' : ' va'} expirer`,
  todoExpireSub: (h: number) => `le premier dans ${h} h s’il n’est pas confirmé`,
  todoSvc: (n: number) => `${n} service${n > 1 ? 's' : ''} en erreur`,
  todoSvcSub: (n: number) => `${n} widget${n > 1 ? 's' : ''} sans données à jour`,
  todoBan: (n: number) => `${n} compte${n > 1 ? 's' : ''} suspendu${n > 1 ? 's' : ''}`, todoBanSub: 'à revoir ou à réactiver',
  see: 'Voir →',
  kAccounts: 'comptes', kWeek: (n: number) => `+${n} cette semaine`, kUnconf: 'non confirmés', kRate: 'taux de confirmation',
  kWidgets: (r: string) => `widgets · ${r} / compte`, kBanned: 'suspendus', kAdmins: 'admins',
  split: 'Répartition', sActive: 'Actifs', sAdmins: 'Admins', sUnconf: 'Non confirmés', sBanned: 'Suspendus', accountsWord: 'comptes',
  growth: 'Croissance sur 14 jours', today: 'aujourd’hui',
  growthDelta: (n: number) => (n > 0 ? `+${n} en 14 jours` : 'stable sur 14 jours'),
  growthTip: (n: number, add: number) => `${n} compte${n > 1 ? 's' : ''}${add > 0 ? ` · +${add} ce jour-là` : ''}`,
  funnel: 'Le voyage des nouveaux', fSigned: 'Inscrits', fConfirmed: 'E-mail confirmé', fWidget: 'Au moins 1 widget', fLinked: 'Un compte lié',
  fSignedSub: 'ont créé un compte', fConfirmedSub: 'ont cliqué sur le lien', fWidgetSub: 'utilisent leur dashboard', fLinkedSub: 'GitHub, Google…',
  lostOnWay: (n: number) => `−${n} en route`, onOf: (n: number) => `sur ${n} inscrit${n > 1 ? 's' : ''}`,
  latest: 'Derniers inscrits', allAccounts: 'Tous les comptes →',
  dayToday: 'Aujourd’hui', dayYesterday: 'Hier', widgetsN: (n: number) => `${n} widget${n > 1 ? 's' : ''}`,
  bActive: 'Actif', bAdmin: 'Admin', bBanned: 'Suspendu', bUnconf: 'Non confirmé', you: '(toi)', expires: (h: number) => `expire dans ${h} h`,
  kbdHint: 'pour passer d’un compte à l’autre', daysOn: 'jours sur Morex', joinedOn: 'Inscrit le', emailLine: 'E-mail', emailOk: 'confirmé ✓', emailWait: 'pas encore confirmé',
  hisWidgets: 'Ses widgets', widgetsOk: (n: number) => `${n} fonctionne${n > 1 ? 'nt' : ''}`, widgetsKo: (n: number) => `${n} en erreur`,
  noWidgetYet: 'Aucun widget pour l’instant', refreshed: (w: string) => `mis à jour ${w}`,
  birthLine: 'Date de naissance', birthNone: 'non renseignée', age: (n: number) => `${n} ans`,
  roleLine: 'Rôle', roleAdmin: 'administrateur', roleUser: 'utilisateur', banReasonLine: 'Motif de suspension', seenLine: (w: string) => `actif ${w}`,
  search: 'Nom ou e-mail…', fAll: 'Tous', fUnconf: 'Non confirmés', fBanned: 'Suspendus', fAdmins: 'Admins', csv: '⬇ CSV', cSeen: 'Dernière activité', cWidgets: 'Widgets', cLinks: 'Comptes liés', cSessions: 'Sessions',
  never: 'jamais', lastLogin: 'Dernière connexion', openSessions: 'Connexions ouvertes', noSessions: 'Aucune connexion ouverte', unknownDevice: 'Appareil inconnu',
  sessionSince: (since: string, seen: string) => `ouverte ${since} · active ${seen}`, noLinks: 'aucun',
  none: 'Aucun compte ne correspond 🔭', bulkCsv: '⬇ Exporter',
  confirm: '✉ Confirmer l’e-mail', ban: '⛔ Suspendre', unban: '↺ Réactiver', del: '🗑 Supprimer', rename: '✎ Renommer',
  lockedSelf: 'C’est ton compte', lockedAdmin: 'On ne peut pas suspendre ou supprimer un autre admin',
  orbit: 'Les services en orbite',
  sumServices: 'services utilisés', sumWidgets: 'widgets au total', sumHealthy: 'services en bonne santé', sumBad: 'services avec des erreurs',
  svcLine: (w: number, u: number, p: number) => `${w} widget${w > 1 ? 's' : ''} chez ${u} compte${u > 1 ? 's' : ''} · ${p} % de tous les widgets`,
  svcUsers: 'comptes qui l’utilisent', svcOk: 'fonctionnent', svcKo: 'en erreur', mostUsed: 'Les widgets les plus utilisés',
  svcErrTitle: (n: number) => `${n} widget${n > 1 ? 's' : ''} n’arrive${n > 1 ? 'nt' : ''} plus à se mettre à jour`, lastErrorLabel: 'Dernière erreur', svcAllGood: 'Tous ses widgets se mettent à jour sans problème',
  ranking: 'Classement', healthy: 'tout va bien',
  failing: (e: number, w: number) => `${e} widget${e > 1 ? 's' : ''} en erreur sur ${w}`, usersOf: (n: number) => `${n} compte${n > 1 ? 's' : ''}`,
  noWidgets: 'Personne n’a encore ajouté de widget 🔭',
  expiring: 'À confirmer avant expiration', expiringNote: 'Le serveur supprime un compte non confirmé 24 h après l’inscription.',
  left: (h: number) => `reste ${h} h`,
  hoursLeftShort: 'restantes', modUrgent: (n: number) => `expire${n > 1 ? 'nt' : ''} dans moins de 3 h`, modToConfirm: 'comptes à confirmer', modSuspended: 'comptes suspendus',
  suspendedNote: 'Ils ne peuvent plus se connecter. Le motif leur a été envoyé par e-mail.', nothingToConfirm: 'Rien à confirmer ✨', suspended: 'Comptes suspendus', nobodySuspended: 'Personne n’est suspendu',
  dBan: (n: string) => `Suspendre ${n}`, dBanMany: (n: number) => `Suspendre ${n} comptes`, dUnban: (n: string) => `Réactiver ${n}`,
  dDelete: (n: string) => `Supprimer ${n}`, dRename: (n: string) => `Renommer ${n}`,
  dBanWhat: 'Ses sessions sont fermées tout de suite et il ne peut plus se connecter. Il reçoit un e-mail avec le motif.',
  dUnbanWhat: 'Il pourra se reconnecter. Un e-mail le prévient.',
  dDeleteWhat: 'Widgets, journal, comptes liés : tout part, pour de bon. Il reçoit un e-mail avec le motif avant.',
  reason: 'Motif (envoyé par e-mail)', presets: ['Spam', 'Faux compte', 'Abus d’une API externe', 'Contenu interdit'],
  preview: 'L’e-mail qu’il va recevoir', typeEmail: (e: string) => `Tape ${e} pour confirmer`,
  firstName: 'Prénom', lastName: 'Nom', cancel: 'Annuler', save: 'Enregistrer', go: 'Confirmer',
  mailBan: (r: string) => `Un administrateur a suspendu ton compte. Motif indiqué : « ${r} ». Tu es déconnecté partout…`,
  mailDelete: (r: string) => `Un administrateur a supprimé définitivement ton compte et tout ce qu’il contenait. Motif indiqué : « ${r} »…`,
  done: { confirm: 'E-mail confirmé', ban: 'Compte suspendu', unban: 'Compte réactivé', delete: 'Compte supprimé', rename: 'Nom modifié' },
}
type Texts = typeof fr

const en: Texts = {
  ...fr,
  brand: 'admin console', back: '← Back to dashboard', role: 'admin', loading: 'Loading…', error: 'Something went wrong',
  nav: { overview: 'Overview', accounts: 'Accounts', services: 'Services', moderation: 'Moderation' },
  hello: ['Good morning', 'Good afternoon', 'Good evening'], 
  gauge: { ok: 'Morex is in great shape', warn: 'Morex is fine, keep an eye on it', bad: 'Morex needs you' },
  healthNone: 'no problem detected', healthTip: 'Health score out of 100',
  hConfirm: (n) => `${n} to confirm`, hSvc: (n) => `${n} service${n > 1 ? 's' : ''} failing`, hBan: (n) => `${n} suspended`,
  todoExpire: (n) => `${n} account${n > 1 ? 's' : ''} about to expire`, todoExpireSub: (h) => `the first one in ${h} h unless confirmed`,
  todoSvc: (n) => `${n} service${n > 1 ? 's' : ''} failing`, todoSvcSub: (n) => `${n} widget${n > 1 ? 's' : ''} without fresh data`,
  todoBan: (n) => `${n} suspended account${n > 1 ? 's' : ''}`, todoBanSub: 'to review or restore', see: 'See →',
  kAccounts: 'accounts', kWeek: (n) => `+${n} this week`, kUnconf: 'unconfirmed', kRate: 'confirmation rate',
  kWidgets: (r) => `widgets · ${r} / account`, kBanned: 'suspended', kAdmins: 'admins',
  split: 'Breakdown', sActive: 'Active', sAdmins: 'Admins', sUnconf: 'Unconfirmed', sBanned: 'Suspended', accountsWord: 'accounts',
  growth: 'Growth over 14 days', today: 'today',
  growthDelta: (n) => (n > 0 ? `+${n} in 14 days` : 'steady over 14 days'),
  growthTip: (n, add) => `${n} account${n > 1 ? 's' : ''}${add > 0 ? ` · +${add} that day` : ''}`,
  funnel: 'The newcomers’ journey', fSigned: 'Signed up', fConfirmed: 'Email confirmed', fWidget: 'At least 1 widget', fLinked: 'A linked account',
  fSignedSub: 'created an account', fConfirmedSub: 'clicked the link', fWidgetSub: 'use their dashboard', fLinkedSub: 'GitHub, Google…',
  lostOnWay: (n) => `−${n} on the way`, onOf: (n) => `out of ${n} sign-up${n > 1 ? 's' : ''}`,
  latest: 'Latest sign-ups', allAccounts: 'All accounts →',
  dayToday: 'Today', dayYesterday: 'Yesterday', widgetsN: (n) => `${n} widget${n > 1 ? 's' : ''}`,
  bActive: 'Active', bAdmin: 'Admin', bBanned: 'Suspended', bUnconf: 'Unconfirmed', you: '(you)', expires: (h) => `expires in ${h} h`,
  kbdHint: 'to move from one account to the next', daysOn: 'days on Morex', joinedOn: 'Joined on', emailLine: 'Email', emailOk: 'confirmed ✓', emailWait: 'not confirmed yet',
  hisWidgets: 'Their widgets', widgetsOk: (n) => `${n} working`, widgetsKo: (n) => `${n} failing`,
  noWidgetYet: 'No widget yet', refreshed: (w) => `refreshed ${w}`,
  birthLine: 'Birth date', birthNone: 'not given', age: (n) => `${n} years old`,
  roleLine: 'Role', roleAdmin: 'administrator', roleUser: 'user', banReasonLine: 'Suspension reason', seenLine: (w) => `active ${w}`,
  search: 'Name or email…', fAll: 'All', fUnconf: 'Unconfirmed', fBanned: 'Suspended', fAdmins: 'Admins', cSeen: 'Last active', cLinks: 'Linked', none: 'No account matches 🔭',
  never: 'never', lastLogin: 'Last login', openSessions: 'Open sessions', noSessions: 'No open session', unknownDevice: 'Unknown device',
  sessionSince: (since, seen) => `opened ${since} · active ${seen}`, noLinks: 'none', bulkCsv: '⬇ Export',
  confirm: '✉ Confirm email', ban: '⛔ Suspend', unban: '↺ Restore', del: '🗑 Delete', rename: '✎ Rename',
  lockedSelf: 'This is your account', lockedAdmin: 'Another admin cannot be suspended or deleted',
  orbit: 'Services in orbit',
  sumServices: 'services in use', sumWidgets: 'widgets in total', sumHealthy: 'healthy services', sumBad: 'services with errors',
  svcLine: (w, u, p) => `${w} widget${w > 1 ? 's' : ''} across ${u} account${u > 1 ? 's' : ''} · ${p} % of all widgets`,
  svcUsers: 'accounts using it', svcOk: 'working', svcKo: 'failing', mostUsed: 'Most used widgets',
  svcErrTitle: (n) => `${n} widget${n > 1 ? 's' : ''} can’t refresh any more`, lastErrorLabel: 'Last error', svcAllGood: 'All its widgets refresh without trouble',
  ranking: 'Ranking', healthy: 'all good',
  failing: (e, w) => `${e} of ${w} widget${w > 1 ? 's' : ''} failing`, usersOf: (n) => `${n} account${n > 1 ? 's' : ''}`,
  noWidgets: 'Nobody has added a widget yet 🔭',
  expiring: 'To confirm before they expire', expiringNote: 'The server deletes an unconfirmed account 24 h after sign-up.',
  left: (h) => `${h} h left`,
  hoursLeftShort: 'left', modUrgent: (n) => `expire${n > 1 ? '' : 's'} in under 3 h`, modToConfirm: 'accounts to confirm', modSuspended: 'suspended accounts',
  suspendedNote: 'They can’t sign in any more. The reason was emailed to them.', nothingToConfirm: 'Nothing to confirm ✨', suspended: 'Suspended accounts', nobodySuspended: 'Nobody is suspended',
  dBan: (n) => `Suspend ${n}`, dBanMany: (n) => `Suspend ${n} accounts`, dUnban: (n) => `Restore ${n}`, dDelete: (n) => `Delete ${n}`, dRename: (n) => `Rename ${n}`,
  dBanWhat: 'Their sessions end right away and they can’t sign in. They get an email with the reason.',
  dUnbanWhat: 'They can sign in again. An email tells them.',
  dDeleteWhat: 'Widgets, journal, linked accounts: everything goes, for good. They get an email with the reason first.',
  reason: 'Reason (emailed to them)', presets: ['Spam', 'Fake account', 'Abuse of an external API', 'Prohibited content'],
  preview: 'The email they will get', typeEmail: (e) => `Type ${e} to confirm`,
  firstName: 'First name', lastName: 'Last name', cancel: 'Cancel', save: 'Save', go: 'Confirm',
  mailBan: (r) => `An administrator suspended your account. Reason given: "${r}". You are logged out everywhere…`,
  mailDelete: (r) => `An administrator permanently deleted your account and everything in it. Reason given: "${r}"…`,
  done: { confirm: 'Email confirmed', ban: 'Account suspended', unban: 'Account restored', delete: 'Account deleted', rename: 'Name updated' },
}

const es: Texts = {
  ...en,
  brand: 'consola admin', back: '← Volver al panel', loading: 'Cargando…', error: 'Algo salió mal',
  nav: { overview: 'Resumen', accounts: 'Cuentas', services: 'Servicios', moderation: 'Moderación' },
  hello: ['Buenos días', 'Buenas tardes', 'Buenas noches'], 
  gauge: { ok: 'Morex está en plena forma', warn: 'Morex va bien, a vigilar', bad: 'Morex te necesita' },
  healthNone: 'ningún problema detectado', healthTip: 'Puntuación de salud sobre 100',
  hConfirm: (n) => `${n} por confirmar`, hSvc: (n) => `${n} servicio${n > 1 ? 's' : ''} con errores`, hBan: (n) => `${n} suspendida${n > 1 ? 's' : ''}`,
  todoExpire: (n) => `${n} cuenta${n > 1 ? 's' : ''} a punto de caducar`, todoExpireSub: (h) => `la primera en ${h} h si no se confirma`,
  todoSvc: (n) => `${n} servicio${n > 1 ? 's' : ''} con errores`, todoSvcSub: (n) => `${n} widget${n > 1 ? 's' : ''} sin datos recientes`,
  todoBan: (n) => `${n} cuenta${n > 1 ? 's' : ''} suspendida${n > 1 ? 's' : ''}`, todoBanSub: 'para revisar o reactivar', see: 'Ver →',
  kAccounts: 'cuentas', kWeek: (n) => `+${n} esta semana`, kUnconf: 'sin confirmar', kRate: 'tasa de confirmación',
  kWidgets: (r) => `widgets · ${r} / cuenta`, kBanned: 'suspendidas', kAdmins: 'admins',
  split: 'Reparto', sActive: 'Activas', sUnconf: 'Sin confirmar', sBanned: 'Suspendidas', accountsWord: 'cuentas',
  growth: 'Crecimiento en 14 días', today: 'hoy',
  growthDelta: (n) => (n > 0 ? `+${n} en 14 días` : 'estable en 14 días'),
  growthTip: (n, add) => `${n} cuenta${n > 1 ? 's' : ''}${add > 0 ? ` · +${add} ese día` : ''}`,
  funnel: 'El viaje de los nuevos', fSigned: 'Registrados', fConfirmed: 'Email confirmado', fWidget: 'Al menos 1 widget', fLinked: 'Una cuenta vinculada',
  fSignedSub: 'crearon una cuenta', fConfirmedSub: 'pulsaron el enlace', fWidgetSub: 'usan su panel', fLinkedSub: 'GitHub, Google…',
  lostOnWay: (n) => `−${n} por el camino`, onOf: (n) => `de ${n} registro${n > 1 ? 's' : ''}`,
  latest: 'Últimos registros', allAccounts: 'Todas las cuentas →',
  dayToday: 'Hoy', dayYesterday: 'Ayer', widgetsN: (n) => `${n} widget${n > 1 ? 's' : ''}`,
  bActive: 'Activa', bBanned: 'Suspendida', bUnconf: 'Sin confirmar', you: '(tú)', expires: (h) => `caduca en ${h} h`,
  kbdHint: 'para pasar de una cuenta a otra', daysOn: 'días en Morex', joinedOn: 'Registro el', emailLine: 'Email', emailOk: 'confirmado ✓', emailWait: 'sin confirmar todavía',
  hisWidgets: 'Sus widgets', widgetsOk: (n) => `${n} funciona${n > 1 ? 'n' : ''}`, widgetsKo: (n) => `${n} con error${n > 1 ? 'es' : ''}`,
  noWidgetYet: 'Ningún widget por ahora', refreshed: (w) => `actualizado ${w}`,
  birthLine: 'Fecha de nacimiento', birthNone: 'sin indicar', age: (n) => `${n} años`,
  roleLine: 'Rol', roleAdmin: 'administrador', roleUser: 'usuario', banReasonLine: 'Motivo de suspensión', seenLine: (w) => `activa ${w}`,
  search: 'Nombre o email…', fAll: 'Todas', fUnconf: 'Sin confirmar', fBanned: 'Suspendidas', cSeen: 'Última actividad', cLinks: 'Vinculadas', cSessions: 'Sesiones', none: 'Ninguna cuenta coincide 🔭',
  never: 'nunca', lastLogin: 'Última conexión', openSessions: 'Sesiones abiertas', noSessions: 'Ninguna sesión abierta', unknownDevice: 'Dispositivo desconocido',
  sessionSince: (since, seen) => `abierta ${since} · activa ${seen}`, noLinks: 'ninguna', bulkCsv: '⬇ Exportar',
  confirm: '✉ Confirmar email', ban: '⛔ Suspender', unban: '↺ Reactivar', del: '🗑 Eliminar', rename: '✎ Renombrar',
  lockedSelf: 'Es tu cuenta', lockedAdmin: 'No se puede suspender ni eliminar a otro admin',
  orbit: 'Los servicios en órbita',
  sumServices: 'servicios usados', sumWidgets: 'widgets en total', sumHealthy: 'servicios sin problemas', sumBad: 'servicios con errores',
  svcLine: (w, u, p) => `${w} widget${w > 1 ? 's' : ''} en ${u} cuenta${u > 1 ? 's' : ''} · ${p} % de todos los widgets`,
  svcUsers: 'cuentas que lo usan', svcOk: 'funcionan', svcKo: 'con error', mostUsed: 'Los widgets más usados',
  svcErrTitle: (n) => `${n} widget${n > 1 ? 's' : ''} ya no se actualiza${n > 1 ? 'n' : ''}`, lastErrorLabel: 'Último error', svcAllGood: 'Todos sus widgets se actualizan sin problema',
  ranking: 'Clasificación', healthy: 'todo bien',
  failing: (e, w) => `${e} de ${w} widget${w > 1 ? 's' : ''} con error`, usersOf: (n) => `${n} cuenta${n > 1 ? 's' : ''}`,
  noWidgets: 'Nadie ha añadido un widget todavía 🔭',
  expiring: 'Por confirmar antes de que caduquen', expiringNote: 'El servidor elimina una cuenta sin confirmar 24 h después del registro.',
  left: (h) => `quedan ${h} h`,
  hoursLeftShort: 'restantes', modUrgent: (n) => `caduca${n > 1 ? 'n' : ''} en menos de 3 h`, modToConfirm: 'cuentas por confirmar', modSuspended: 'cuentas suspendidas',
  suspendedNote: 'Ya no pueden entrar. Se les envió el motivo por email.', nothingToConfirm: 'Nada que confirmar ✨', suspended: 'Cuentas suspendidas', nobodySuspended: 'Nadie está suspendido',
  dBan: (n) => `Suspender a ${n}`, dBanMany: (n) => `Suspender ${n} cuentas`, dUnban: (n) => `Reactivar a ${n}`, dDelete: (n) => `Eliminar a ${n}`, dRename: (n) => `Renombrar a ${n}`,
  dBanWhat: 'Sus sesiones se cierran al instante y no puede entrar. Recibe un email con el motivo.',
  dUnbanWhat: 'Podrá volver a entrar. Un email se lo avisa.',
  dDeleteWhat: 'Widgets, diario, cuentas vinculadas: todo desaparece, para siempre. Antes recibe un email con el motivo.',
  reason: 'Motivo (enviado por email)', presets: ['Spam', 'Cuenta falsa', 'Abuso de una API externa', 'Contenido prohibido'],
  preview: 'El email que recibirá', typeEmail: (e) => `Escribe ${e} para confirmar`,
  firstName: 'Nombre', lastName: 'Apellido', cancel: 'Cancelar', save: 'Guardar', go: 'Confirmar',
  mailBan: (r) => `Un administrador suspendió tu cuenta. Motivo indicado: «${r}». Se cerró tu sesión en todas partes…`,
  mailDelete: (r) => `Un administrador eliminó permanentemente tu cuenta y todo su contenido. Motivo indicado: «${r}»…`,
  done: { confirm: 'Email confirmado', ban: 'Cuenta suspendida', unban: 'Cuenta reactivada', delete: 'Cuenta eliminada', rename: 'Nombre actualizado' },
}

export const TEXTS: Record<Lang, Texts> = { fr, en, es }
export type AdminTexts = Texts
