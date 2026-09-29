import { useEffect, useRef, useState } from 'react'
import { LOCALE, tr, type Lang } from '../../lib/i18n'
import { avatarUrl, DEFAULT_AVATAR } from '../../lib/avatar'
import { useNow } from '../../lib/format'
import type { User, WidgetInstance } from '../../lib/types'
import { CATALOG, SERVICES, entryFor, type CatalogEntry } from '../../lib/catalog'

export const THEMES: [string, string, string][] = [
  ['galaxy', '/accueil_photo.jpg', '50% 28%'], ['aurora', '/aurore_boreale.jpeg', '50% 30%'], ['moon', '/cheval.jpeg', '50% 28%'],
  ['dolphins', '/dauphins_theme.jpeg', '50% 58%'], ['forest', '/foret_theme.jpeg', '50% 42%'], ['mystic', '/mystical_theme.jpeg', '50% 42%'],
  ['ocean', '/ocean_theme.jpeg', '50% 32%'], ['beach', '/plage_theme.jpeg', '50% 62%'], ['desertNight', '/sahara_night.jpeg', '50% 68%'],
  ['desertMoon', '/sahara_theme.jpeg', '50% 10%'],
]
const SKINS: [string, string, React.CSSProperties][] = [
  ['glass', 'skGlass', { background: 'rgb(255 255 255 / .3)', border: '1px solid #fff' }],
  ['neon', 'skNeon', { background: '#0b1026', boxShadow: '0 0 8px var(--a1)', border: '1px solid var(--a1)' }],
  ['pastel', 'skPastel', { background: 'linear-gradient(135deg,#fbcfe8,#c7d2fe)' }],
  ['minimal', 'skMinimal', { background: '#0a0c14', border: '1px solid #333' }],
  ['holo', 'skHolo', { background: 'linear-gradient(135deg,#f0abfc,#93c5fd,#6ee7b7,#fde68a)' }],
]

export const avatarSrc = (user: User) => user.avatarPhotoUrl || avatarUrl({ ...DEFAULT_AVATAR, ...(user.avatarConfig ?? {}) })
export const displayName = (user: User) => [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

export function Avatar({ user, className = 'avatar', onClick, children }: { user: User; className?: string; onClick?: () => void; children?: React.ReactNode }) {
  return <div className={className} onClick={onClick}><img src={avatarSrc(user)} alt="" />{children}</div>
}

const I = {
  grid: <svg className="i" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>,
  user: <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>,
  sun: <svg className="i" viewBox="0 0 24 24"><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /><circle cx="12" cy="12" r="4" /></svg>,
  help: <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01" /></svg>,
  out: <svg className="i" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h11" /></svg>,
  globe: <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>,
  lens: <svg className="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
}

// ---------- Sidebar (collapsible) ----------
export function Sidebar({ lang, onToggle, onProfile, onHelp, onLogout }: {
  lang: Lang; onToggle: () => void; onProfile: () => void; onHelp: () => void; onLogout: () => void
}) {
  const t = tr(lang)
  const link = (icon: React.ReactNode, label: string, onClick?: () => void, cls = '') => (
    <a href="#" className={cls} title={label} onClick={(e) => { e.preventDefault(); onClick?.() }}>{icon}<span>{label}</span></a>
  )
  return (
    <aside className="glass">
      <div className="side-head">
        <div className="brand"><img src="/logo.svg" alt="" /><span className="brand-name">Morex</span></div>
        <button className="side-toggle" onClick={onToggle} aria-label="Menu"><svg className="i" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg></button>
      </div>
      <nav aria-label={t.mainNav}>
        {link(I.grid, t.navDash, undefined, 'on')}
        {link(I.user, t.navProfile, onProfile)}
      </nav>
      <nav className="bottom" aria-label={t.accountNav}>
        {link(I.help, t.help, onHelp)}
        {link(I.out, t.logout, onLogout, 'danger')}
      </nav>
    </aside>
  )
}

// ---------- Top bar: language, theme, widget style, account menu ----------
function PillMenu({ id, open, setOpen, button, children, menuClass = '' }: {
  id: string; open: string | null; setOpen: (v: string | null) => void; button: React.ReactNode; children: React.ReactNode; menuClass?: string
}) {
  return (
    <div className={`pill-menu${open === id ? ' open' : ''}`} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen(open === id ? null : id)}>{button}</button>
      <div className={`menu glass ${menuClass}`}>{children}</div>
    </div>
  )
}

export function Toolbar({ user, lang, theme, skin, onLang, onTheme, onSkin, onOpen }: {
  user: User; lang: Lang; theme: string; skin: string
  onLang: (l: Lang) => void; onTheme: (t: string) => void; onSkin: (s: string) => void
  onOpen: (what: 'profile' | 'avatar' | 'journal' | 'help' | 'logout') => void
}) {
  const t = tr(lang) as unknown as Record<string, string>
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    const close = () => setOpen(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  const pick = (fn: () => void) => { fn(); setOpen(null) }
  return (
    <div className="top">
      <PillMenu id="lang" open={open} setOpen={setOpen} button={<>{I.globe}<span>{lang.toUpperCase()}</span></>}>
        <button onClick={() => pick(() => onLang('fr'))}>🇫🇷 Français</button><button onClick={() => pick(() => onLang('en'))}>🇬🇧 English</button><button onClick={() => pick(() => onLang('es'))}>🇪🇸 Español</button>
      </PillMenu>
      <PillMenu id="theme" open={open} setOpen={setOpen} menuClass="theme-grid" button={<><span className="swatch" style={{ background: 'linear-gradient(135deg,var(--a1),var(--a2))' }} /><span>{t.theme}</span></>}>
        {THEMES.map(([k, img, bp]) => (
          <button key={k} className={k === theme ? 'on' : ''} onClick={() => pick(() => onTheme(k))}>
            <span className="thumb" style={{ backgroundImage: `url(${img})`, backgroundPosition: bp }} /><span>{t[`th_${k}`]}</span>
          </button>
        ))}
      </PillMenu>
      <PillMenu id="skin" open={open} setOpen={setOpen} button={<>{I.grid}<span>{t.wStyle}</span></>}>
        {SKINS.map(([k, label, style]) => <button key={k} className={k === skin ? 'on' : ''} onClick={() => pick(() => onSkin(k))}><span className="swatch" style={style} /><span>{t[label]}</span></button>)}
      </PillMenu>
      {/* The photo opens the avatar editor directly (profile, help and log out are in the sidebar) */}
      <button className="avatar" style={{ padding: 0, border: 0 }} aria-label={t.changeAvatar} title={t.changeAvatar} onClick={() => onOpen('avatar')}>
        <img src={avatarSrc(user)} alt="" />
      </button>
    </div>
  )
}

// ---------- Search: a magnifier that unrolls into a bar ----------
export function SearchBar({ lang, widgets, onGoWidget, onAdd }: {
  lang: Lang; widgets: WidgetInstance[]; onGoWidget: (id: string) => void; onAdd: (entry: CatalogEntry) => void
}) {
  const t = tr(lang), [open, setOpen] = useState(false), [q, setQ] = useState(''), box = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null)
  const close = () => { setOpen(false); setQ(''); input.current?.blur() }
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (open && box.current && !box.current.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  const needle = q.trim().toLowerCase()
  const mine = widgets.map((w) => ({ w, e: entryFor(w.serviceName, w.widgetName) })).filter(({ w, e }) => e && `${w.title ?? ''} ${e.name[lang]} ${SERVICES[e.service]?.label[lang]} ${Object.values(w.config).join(' ')}`.toLowerCase().includes(needle)).slice(0, 5)
  const services = CATALOG.filter((e) => `${e.name[lang]} ${SERVICES[e.service].label[lang]} ${e.service}`.toLowerCase().includes(needle)).slice(0, 6)
  return (
    <div className="search-row">
      <div ref={box} className={`search${open ? ' open' : ''}`}>
        <button className="lens" aria-label={t.search} onClick={() => (open ? close() : (setOpen(true), setTimeout(() => input.current?.focus(), 200)))}>{I.lens}</button>
        <input ref={input} placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="results glass">
          {/* A category label inside a transient search popover, not a real page section — a real <h6>
              here would put it in the page's heading outline with nothing at h2-h5 above it. */}
          {mine.length > 0 && <p className="res-label">{t.resWidgets}</p>}
          {mine.map(({ w, e }) => (
            <a key={w.id} href="#" onClick={(ev) => { ev.preventDefault(); close(); onGoWidget(w.id) }}>
              {SERVICES[e!.service].label[lang]} · {w.title || e!.name[lang]} <span>{String(Object.values(w.config)[0] ?? '').replace('********', '🔒')}</span>
            </a>
          ))}
          <p className="res-label">{t.resServices}</p>
          {services.map((e) => (
            <a key={e.kind} href="#" onClick={(ev) => { ev.preventDefault(); close(); onAdd(e) }}>{SERVICES[e.service].label[lang]} · {e.name[lang]} <span>{t.add}</span></a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Hero: greeting, planet clock, journal ----------
function greeting(lang: Lang) {
  const h = new Date().getHours(), t = tr(lang)
  if (h >= 18 || h < 5) return t.evening
  if (h >= 12 && t.afternoon) return t.afternoon
  return t.morning
}

export function Hero({ user, lang, onAvatar, onBio, onJournal }: { user: User; lang: Lang; onAvatar: () => void; onBio: () => void; onJournal: () => void }) {
  const t = tr(lang), now = useNow(1000), sec = now.getSeconds(), loc = LOCALE[lang]
  return (
    <div className="hero">
      <div className="glass hello-card">
        <div className="orb" aria-hidden="true" />
        <div className="ghost" aria-hidden="true">{now.getDate()}</div>
        <Avatar user={user} onClick={onAvatar} />
        <div className="txt">
          <p className="ghost-sub"><span>{now.toLocaleDateString(loc, { weekday: 'long' })}</span> · <span>{now.toLocaleDateString(loc, { month: 'long' })}</span></p>
          <h1 className="hello">{greeting(lang)}, <span className="grad">{user.firstName || displayName(user)}</span></h1>
          <p className={`bio ${String(user.avatarConfig?.bioFont ?? '')}`} style={{ color: user.avatarConfig?.bioColor || undefined }}>{user.bio || t.bio}</p>
          <div className="chips"><button className="edit-link" onClick={onBio}>{t.editBio}</button></div>
        </div>
      </div>
      <div className="glass clock-card">
        <div className="planet-clock">
          <div className="pc-orbit" />
          <div className="pc-moon" style={{ transform: `rotate(${sec * 6}deg)`, transition: sec === 0 ? 'none' : undefined }}><b /><i /></div>
          <div className="pc-planet">
            <div className="clock">{now.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="secs">{String(sec).padStart(2, '0')}</div>
          </div>
        </div>
      </div>
      <div className="glass journal-card" role="button" tabIndex={0} onClick={onJournal} onKeyDown={(e) => e.key === 'Enter' && onJournal()}>
        <p className="mini-title">{t.journal}</p>
        <div className="mini-book" aria-hidden="true">
          <div className="pg l"><span className="ink">{lang === 'fr' ? <>Cher journal,<br />aujourd'hui…</> : lang === 'es' ? <>Querido diario,<br />hoy…</> : <>Dear journal,<br />today…</>}</span></div>
          <div className="pg r" />
          {[0, 1, 2].map((i) => <div key={i} className="leaf"><div className="face front" /><div className="face back" /></div>)}
        </div>
      </div>
    </div>
  )
}
