import type { Lang } from '../../lib/i18n'
import type { User } from '../../lib/types'
import { useNow } from '../../lib/format'
import { AUTH } from '../../lib/authLang'
import { avatarSrc } from '../morex/Chrome'
import { UserAvatar, Spark, growth, hoursLeft, health, stats, fullName, type AdminTexts, type AdminUser, type Filter, type Section, type ServiceStat } from './shared'
import { GrowthChart } from './GrowthChart'
import { RingPlanet, type RingPart } from './RingPlanet'
import { Voyage, type VoyageStep } from './Voyage'

// "Vue d'ensemble": greeting, what needs doing now, key numbers, three charts and the latest sign-ups.
export function AdminOverview({ me, users, services, t, lang, go }: {
  me: User; users: AdminUser[]; services: ServiceStat[]; t: AdminTexts; lang: Lang; go: (s: Section, f?: Filter) => void
}) {
  const s = stats(users)
  const unconfirmed = users.filter((u) => !u.emailVerified)
  const failing = services.filter((x) => x.errors > 0)
  const curve = growth(users)
  const now = useNow(10_000)
  const h = now.getHours()
  const todos = [
    unconfirmed.length > 0 && { icon: '⏳', color: '#fbbf24', title: t.todoExpire(unconfirmed.length), sub: t.todoExpireSub(Math.min(...unconfirmed.map(hoursLeft))), to: 'moderation' as Section },
    failing.length > 0 && { icon: '🛰', color: '#f87171', title: t.todoSvc(failing.length), sub: t.todoSvcSub(failing.reduce((n, x) => n + x.errors, 0)), to: 'services' as Section },
    s.banned > 0 && { icon: '⛔', color: '#a78bfa', title: t.todoBan(s.banned), sub: t.todoBanSub, to: 'moderation' as Section },
  ].filter(Boolean) as { icon: string; color: string; title: string; sub: string; to: Section }[]
  const parts: RingPart[] = [
    { label: t.sActive, value: users.filter((u) => u.emailVerified && !u.isBanned && !u.isAdmin).length, color: '#34d399', onClick: () => go('accounts', 'all') },
    { label: t.sAdmins, value: users.filter((u) => u.isAdmin && !u.isBanned).length, color: '#a78bfa', onClick: () => go('accounts', 'admins') },
    { label: t.sUnconf, value: users.filter((u) => !u.emailVerified && !u.isBanned && !u.isAdmin).length, color: '#fbbf24', onClick: () => go('accounts', 'unconfirmed') },
    { label: t.sBanned, value: s.banned, color: '#f87171', onClick: () => go('accounts', 'banned') },
  ]
  const voyage: VoyageStep[] = [
    { label: t.fSigned, sub: t.fSignedSub, value: s.all },
    { label: t.fConfirmed, sub: t.fConfirmedSub, value: s.all - s.unconfirmed },
    { label: t.fWidget, sub: t.fWidgetSub, value: users.filter((u) => u.widgetCount > 0).length },
    { label: t.fLinked, sub: t.fLinkedSub, value: users.filter((u) => u.linkedAccountsCount > 0).length },
  ]
  const kpis = [
    { v: s.all, l: t.kAccounts, extra: s.newThisWeek ? t.kWeek(s.newThisWeek) : '', spark: curve.map((p) => p.count), color: '#a78bfa', to: ['accounts', 'all'] as const },
    { v: s.unconfirmed, l: t.kUnconf, color: '#fde68a', share: s.unconfirmed / (s.all || 1), to: ['moderation'] as const },
    { v: `${s.confirmRate} %`, l: t.kRate, color: '#34d399', share: s.confirmRate / 100, to: ['accounts', 'unconfirmed'] as const },
    { v: s.widgets, l: t.kWidgets((s.widgets / (s.all || 1)).toFixed(1)), color: '#f472b6', share: 1, to: ['services'] as const },
    { v: s.banned, l: t.kBanned, color: '#fca5a5', share: s.banned / (s.all || 1), to: ['moderation'] as const },
    { v: s.admins, l: t.kAdmins, color: '#c4b5fd', share: s.admins / (s.all || 1), to: ['accounts', 'admins'] as const },
  ]
  const latest = [...users].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)

  return (
    <>
      {/* Same greeting card as the dashboard: ghost day number, WEEKDAY · MONTH, avatar, and the Morex slogan as the bio */}
      <div className="adm-glass adm-hello">
        <div className="adm-orb" aria-hidden="true" />
        <div className="adm-ghost" aria-hidden="true">{now.getDate()}</div>
        <img className="adm-hello-av" src={avatarSrc(me)} alt="" />
        <div className="adm-hello-txt">
          <p className="adm-ghost-sub"><span>{now.toLocaleDateString(lang, { weekday: 'long' })}</span> · <span>{now.toLocaleDateString(lang, { month: 'long' })}</span></p>
          <h2>{t.hello[h < 12 ? 0 : h < 18 ? 1 : 2]}, <span className="adm-grad">{me.firstName || me.email}</span></h2>
          <p className="adm-bio">{AUTH[lang].slogan}</p>
          <div className="adm-hello-chips">
        <HealthGauge users={users} services={services} t={t} />
          </div>
        </div>
      </div>

      {todos.length > 0 && (
        <div className="adm-todo">
          {todos.map((x) => (
            <div key={x.title} className="adm-glass" style={{ '--c': x.color } as React.CSSProperties}>
              <span className="adm-todo-ic">{x.icon}</span>
              <div><b>{x.title}</b><small>{x.sub}</small></div>
              <button className="adm-btn sm" onClick={() => go(x.to)}>{t.see}</button>
            </div>
          ))}
        </div>
      )}

      <div className="adm-kpis">
        {kpis.map((k) => (
          <button key={k.l} className="adm-glass adm-kpi" onClick={() => go(k.to[0], k.to[1])}>
            <div className="v" style={{ color: k.color }}>{k.v}{k.extra && <small>{k.extra}</small>}</div>
            <div className="l">{k.l}</div>
            {k.spark ? <Spark values={k.spark} color={k.color} /> : <span className="adm-meter"><i style={{ width: `${Math.round((k.share ?? 0) * 100)}%`, background: k.color }} /></span>}
          </button>
        ))}
      </div>

      <div className="adm-row adm-r2">
        <div className="adm-glass adm-card adm-split">
          <h3>{t.split}</h3>
          <RingPlanet parts={parts} total={s.all} word={t.accountsWord} />
        </div>
        <div className="adm-glass adm-card">
          <h3>{t.growth}</h3>
          <GrowthChart points={curve} t={t} lang={lang} />
        </div>
      </div>

      <div className="adm-glass adm-card">
        <h3>{t.funnel}<small className="adm-h3-note">{t.onOf(s.all)}</small></h3>
        <Voyage steps={voyage} t={t} />
      </div>

      <div className="adm-glass adm-card">
        <h3>{t.latest}<button className="adm-btn sm" onClick={() => go('accounts', 'all')}>{t.allAccounts}</button></h3>
        <SignupTimeline users={latest} t={t} lang={lang} onOpen={() => go('accounts', 'all')} />
      </div>
    </>
  )
}

export function StatusBadges({ u, t }: { u: AdminUser; t: AdminTexts }) {
  return (
    <span className="adm-badges">
      {u.isAdmin && <span className="adm-badge admin">★ {t.bAdmin}</span>}
      {u.isBanned && <span className="adm-badge ban" title={u.banReason ?? undefined}>⛔ {t.bBanned}</span>}
      {!u.emailVerified && <span className="adm-badge unconf">✉ {t.bUnconf}</span>}
      {u.emailVerified && !u.isBanned && !u.isAdmin && <span className="adm-badge ok">● {t.bActive}</span>}
    </span>
  )
}

const C = 2 * Math.PI * 27
function HealthGauge({ users, services, t }: { users: AdminUser[]; services: ServiceStat[]; t: AdminTexts }) {
  const h = health(users, services)
  const why = [h.pending && t.hConfirm(h.pending), h.failing && t.hSvc(h.failing), h.banned && t.hBan(h.banned)].filter(Boolean).join(' · ')
  return (
    <span className={`adm-gauge ${h.level}`} title={t.healthTip}>
      <svg viewBox="0 0 66 66">
        <circle cx="33" cy="33" r="27" fill="none" stroke="rgb(255 255 255 / .1)" strokeWidth="6" />
        <circle cx="33" cy="33" r="27" fill="none" stroke="rgb(var(--c))" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(h.score / 100) * C} ${C}`} transform="rotate(-90 33 33)" />
        <text x="33" y="39" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">{h.score}</text>
      </svg>
      <span><b>{t.gauge[h.level]}</b><small>{why || t.healthNone}</small></span>
    </span>
  )
}

const STATUS_COLOR = (u: AdminUser) => (u.isBanned ? '#f87171' : !u.emailVerified ? '#fbbf24' : u.isAdmin ? '#a78bfa' : '#34d399')

// "Derniers inscrits" as a timeline grouped by day (today, yesterday, then the date), each arrival with
// its exact time, the user's own avatar, their email and widget count, and their status
function SignupTimeline({ users, t, lang, onOpen }: { users: AdminUser[]; t: AdminTexts; lang: Lang; onOpen: () => void }) {
  const dayKey = (d: Date) => d.toDateString()
  const today = new Date(), yesterday = new Date(Date.now() - 86_400_000)
  const dayLabel = (d: Date) => (dayKey(d) === dayKey(today) ? t.dayToday : dayKey(d) === dayKey(yesterday) ? t.dayYesterday
    : d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }))
  let last = ''
  return (
    <div className="adm-tl">
      {users.map((u) => {
        const d = new Date(u.createdAt), label = dayLabel(d), head = label !== last
        last = label
        return (
          <div key={u.id}>
            {head && <div className="adm-tl-day">{label}</div>}
            <button className="adm-tl-ev" style={{ '--c': STATUS_COLOR(u) } as React.CSSProperties} onClick={onOpen}>
              <span className="adm-tl-hr adm-num">{d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}</span>
              <UserAvatar u={u} size={42} />
              <span className="adm-grow"><b>{fullName(u)}</b><small>{u.email} · {t.widgetsN(u.widgetCount)}</small></span>
              {!u.emailVerified ? <span className="adm-badge unconf">⏳ {t.expires(hoursLeft(u))}</span> : <StatusBadges u={u} t={t} />}
            </button>
          </div>
        )
      })}
    </div>
  )
}
