import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../../lib/api'
import { paramLabel, W, type Lang } from '../../lib/i18n'
import { ZODIAC, type CatalogEntry } from '../../lib/catalog'
import { compact, flagOf } from '../../lib/format'
import type { User, WidgetParam } from '../../lib/types'

// The settings form of a widget, with a friendly control for each setting instead of a raw text field:
// lists to pick from (fed by the backend's suggestion routes), buttons, sliders, a guide, a JSON explorer.
// Anything not covered here falls back to a plain field, so a new backend param always works.

type Cfg = Record<string, string>
type L3 = Record<Lang, string>
const T: Record<string, L3> = {
  orPaste: { fr: '…ou colle l’adresse d’un flux', en: '…or paste a feed address', es: '…o pega la dirección de un feed' },
  search: { fr: 'Rechercher…', en: 'Search…', es: 'Buscar…' },
  none: { fr: 'Aucun résultat', en: 'No results', es: 'Sin resultados' },
  popular: { fr: 'Populaires', en: 'Popular', es: 'Populares' },
  yourRepos: { fr: 'Tes dépôts', en: 'Your repositories', es: 'Tus repositorios' },
  known: { fr: 'Ou un dépôt connu', en: 'Or a well-known one', es: 'O uno conocido' },
  notLinked: { fr: 'Connecte GitHub pour voir tes dépôts ici. Seuls les dépôts publics peuvent être lus', en: 'Connect GitHub to see your repositories here. Only public repositories can be read', es: 'Conecta GitHub para ver tus repositorios aquí. Solo se pueden leer los públicos' },
  otherCountry: { fr: 'Autre pays…', en: 'Other country…', es: 'Otro país…' },
  whereCal: { fr: 'Où est ton agenda ?', en: 'Where is your calendar?', es: '¿Dónde está tu agenda?' },
  publicCal: { fr: 'Ou un agenda public', en: 'Or a public calendar', es: 'O una agenda pública' },
  bj: { fr: 'Jours fériés au Bénin', en: 'Benin holidays', es: 'Festivos de Benín' },
  fr: { fr: 'Jours fériés en France', en: 'France holidays', es: 'Festivos de Francia' },
  icsOk: { fr: 'Adresse d’agenda reconnue', en: 'Calendar address recognised', es: 'Dirección de agenda reconocida' },
  icsBad: { fr: 'Ce n’est pas une adresse d’agenda (.ics)', en: 'This is not a calendar address (.ics)', es: 'No es una dirección de agenda (.ics)' },
  pickValue: { fr: 'Clique sur la valeur à afficher', en: 'Click the value to show', es: 'Haz clic en el valor que quieres mostrar' },
  pickList: { fr: 'Clique sur la liste à afficher', en: 'Click the list to show', es: 'Haz clic en la lista que quieres mostrar' },
  pickField: { fr: 'Clique sur le champ à utiliser', en: 'Click the field to use', es: 'Haz clic en el campo que quieres usar' },
  reading: { fr: 'Lecture de l’API…', en: 'Reading the API…', es: 'Leyendo la API…' },
  noJson: { fr: 'Pas de JSON lisible à cette adresse : tu peux écrire le chemin toi-même', en: 'No readable JSON at this address: you can type the path yourself', es: 'No hay JSON legible en esta dirección: puedes escribir la ruta tú mismo' },
  videoOk: { fr: 'Vidéo reconnue', en: 'Video recognised', es: 'Vídeo reconocido' },
  channelHint: { fr: 'Colle le lien de la chaîne ou son @ (ex. @Squeezie)', en: 'Paste the channel link or its @ (e.g. @Squeezie)', es: 'Pega el enlace del canal o su @ (p. ej. @Squeezie)' },
  secretKept: { fr: 'Laisse vide pour garder la valeur actuelle', en: 'Leave empty to keep the current value', es: 'Déjalo vacío para mantener el valor actual' },
}
const CAL_STEPS: Record<'google' | 'outlook' | 'apple', L3[]> = {
  google: [{ fr: 'Ouvre calendar.google.com, puis ⚙️ Paramètres', en: 'Open calendar.google.com, then ⚙️ Settings', es: 'Abre calendar.google.com y luego ⚙️ Configuración' },
    { fr: 'Clique sur ton agenda sous « Paramètres de mes agendas »', en: 'Click your calendar under “Settings for my calendars”', es: 'Haz clic en tu agenda en «Configuración de mis calendarios»' },
    { fr: 'Copie « Adresse secrète au format iCal » tout en bas', en: 'Copy “Secret address in iCal format” at the very bottom', es: 'Copia «Dirección secreta en formato iCal» al final' }],
  outlook: [{ fr: 'Ouvre outlook.com, puis ⚙️ Paramètres, Calendrier', en: 'Open outlook.com, then ⚙️ Settings, Calendar', es: 'Abre outlook.com y luego ⚙️ Configuración, Calendario' },
    { fr: '« Calendriers partagés », puis « Publier un calendrier »', en: '“Shared calendars”, then “Publish a calendar”', es: '«Calendarios compartidos» y luego «Publicar un calendario»' },
    { fr: 'Choisis ton agenda et copie le lien ICS', en: 'Pick your calendar and copy the ICS link', es: 'Elige tu agenda y copia el enlace ICS' }],
  apple: [{ fr: 'Dans l’app Calendrier, clic droit sur ton agenda', en: 'In the Calendar app, right-click your calendar', es: 'En la app Calendario, clic derecho en tu agenda' },
    { fr: '« Partager le calendrier », puis coche « Calendrier public »', en: '“Share calendar”, then tick “Public calendar”', es: '«Compartir calendario» y marca «Calendario público»' },
    { fr: 'Copie le lien (remplace webcal:// par https://)', en: 'Copy the link (replace webcal:// with https://)', es: 'Copia el enlace (cambia webcal:// por https://)' }],
}
const HOLIDAYS = {
  bj: 'https://calendar.google.com/calendar/ical/fr.bj%23holiday%40group.v.calendar.google.com/public/basic.ics',
  fr: 'https://calendar.google.com/calendar/ical/fr.french%23holiday%40group.v.calendar.google.com/public/basic.ics',
}
const CATS: Record<string, L3> = {
  news: { fr: 'Actualités', en: 'News', es: 'Noticias' }, tech: { fr: 'Tech', en: 'Tech', es: 'Tecnología' }, science: { fr: 'Science', en: 'Science', es: 'Ciencia' },
  sport: { fr: 'Sport', en: 'Sport', es: 'Deporte' }, business: { fr: 'Économie', en: 'Business', es: 'Economía' },
}
// Most-used cryptocurrencies first (the backend search is a plain name match)
const POPULAR: [string, string, string, string, string][] = [['bitcoin', 'Bitcoin', 'BTC', '₿', '#f7931a'], ['ethereum', 'Ethereum', 'ETH', 'Ξ', '#627eea'], ['solana', 'Solana', 'SOL', '◎', '#9945ff'],
  ['binancecoin', 'BNB', 'BNB', 'B', '#f3ba2f'], ['ripple', 'XRP', 'XRP', '✕', '#3a4750'], ['dogecoin', 'Dogecoin', 'DOGE', 'Ð', '#c2a633'], ['cardano', 'Cardano', 'ADA', '₳', '#0033ad'], ['tether', 'Tether', 'USDT', '₮', '#26a17b']]
const FIAT_COUNTRY: Record<string, string> = { eur: 'EU', usd: 'US', gbp: 'GB', jpy: 'JP', chf: 'CH', cad: 'CA', aud: 'AU', brl: 'BR', cny: 'CN', czk: 'CZ', xof: 'BJ', inr: 'IN', ngn: 'NG', mad: 'MA', krw: 'KR', dkk: 'DK', hkd: 'HK', huf: 'HU', idr: 'ID', ils: 'IL', isk: 'IS', mxn: 'MX', myr: 'MY', nok: 'NO', nzd: 'NZ', php: 'PH', pln: 'PL', ron: 'RO', sek: 'SE', try: 'TR', zar: 'ZA', sgd: 'SG', thb: 'TH', bgn: 'BG', xaf: 'CM', ghs: 'GH', kes: 'KE', egp: 'EG', sar: 'SA', aed: 'AE', twd: 'TW', vnd: 'VN', pkr: 'PK', clp: 'CL', cop: 'CO', ars: 'AR', pen: 'PE', uah: 'UA', rub: 'RU', hrk: 'HR' }
const TOP_COUNTRIES = ['FR', 'BJ', 'US', 'GB', 'CA', 'BE', 'CI', 'SN', 'MA', 'ES', 'DE', 'JP']
const KNOWN_REPOS = ['facebook/react', 'microsoft/vscode', 'nestjs/nest', 'vitejs/vite']
// Sliders and button groups for whole numbers: widget.param → [min, max] (the backend's own limits)
const RANGES: Record<string, [number, number]> = {
  'article_list.number': [1, 10], 'recent_commits.number': [1, 20], 'open_issues.number': [1, 20], 'price_history.days': [1, 90],
  'daily_forecast.days': [1, 16], 'hourly_forecast.hours': [1, 48], 'upcoming_events.days': [1, 60], 'upcoming_events.number': [1, 30],
  'planning.days': [1, 60], 'planning.number': [1, 30], 'json_list.number': [1, 30], 'latest_videos.number': [1, 10], 'trending.number': [1, 10],
}
// What each slider actually counts, so it reads "Nombre d’articles · 4 articles" instead of a vague "Nombre · 4 nombre".
// [field label, unit for 1, unit for several]
const COUNTS: Record<string, [L3, L3, L3]> = {
  'article_list.number': [{ fr: 'Nombre d’articles', en: 'Number of articles', es: 'Número de artículos' }, { fr: 'article', en: 'article', es: 'artículo' }, { fr: 'articles', en: 'articles', es: 'artículos' }],
  'recent_commits.number': [{ fr: 'Nombre de commits', en: 'Number of commits', es: 'Número de commits' }, { fr: 'commit', en: 'commit', es: 'commit' }, { fr: 'commits', en: 'commits', es: 'commits' }],
  'open_issues.number': [{ fr: 'Nombre d’issues', en: 'Number of issues', es: 'Número de issues' }, { fr: 'issue', en: 'issue', es: 'issue' }, { fr: 'issues', en: 'issues', es: 'issues' }],
  'price_history.days': [{ fr: 'Période du graphique', en: 'Chart period', es: 'Periodo del gráfico' }, { fr: 'jour', en: 'day', es: 'día' }, { fr: 'jours', en: 'days', es: 'días' }],
  'daily_forecast.days': [{ fr: 'Jours de prévision', en: 'Forecast days', es: 'Días de previsión' }, { fr: 'jour', en: 'day', es: 'día' }, { fr: 'jours', en: 'days', es: 'días' }],
  'hourly_forecast.hours': [{ fr: 'Heures de prévision', en: 'Forecast hours', es: 'Horas de previsión' }, { fr: 'heure', en: 'hour', es: 'hora' }, { fr: 'heures', en: 'hours', es: 'horas' }],
  'upcoming_events.days': [{ fr: 'Regarder sur', en: 'Look ahead', es: 'Mirar durante' }, { fr: 'jour', en: 'day', es: 'día' }, { fr: 'jours', en: 'days', es: 'días' }],
  'upcoming_events.number': [{ fr: 'Nombre d’événements', en: 'Number of events', es: 'Número de eventos' }, { fr: 'événement', en: 'event', es: 'evento' }, { fr: 'événements', en: 'events', es: 'eventos' }],
  'planning.days': [{ fr: 'Regarder sur', en: 'Look ahead', es: 'Mirar durante' }, { fr: 'jour', en: 'day', es: 'día' }, { fr: 'jours', en: 'days', es: 'días' }],
  'planning.number': [{ fr: 'Nombre d’activités', en: 'Number of activities', es: 'Número de actividades' }, { fr: 'activité', en: 'activity', es: 'actividad' }, { fr: 'activités', en: 'activities', es: 'actividades' }],
  'json_list.number': [{ fr: 'Nombre d’éléments', en: 'Number of items', es: 'Número de elementos' }, { fr: 'élément', en: 'item', es: 'elemento' }, { fr: 'éléments', en: 'items', es: 'elementos' }],
  'latest_videos.number': [{ fr: 'Nombre de vidéos', en: 'Number of videos', es: 'Número de vídeos' }, { fr: 'vidéo', en: 'video', es: 'vídeo' }, { fr: 'vidéos', en: 'videos', es: 'vídeos' }],
  'trending.number': [{ fr: 'Nombre de vidéos', en: 'Number of videos', es: 'Número de vídeos' }, { fr: 'vidéo', en: 'video', es: 'vídeo' }, { fr: 'vidéos', en: 'videos', es: 'vídeos' }],
}
const SEGMENTS: Record<string, [string, L3][]> = {
  'exchange_rate.days': [['1', { fr: '24 h', en: '24 h', es: '24 h' }], ['7', { fr: '7 jours', en: '7 days', es: '7 días' }], ['30', { fr: '30 jours', en: '30 days', es: '30 días' }]],
  'daily_changes.hours': [['24', { fr: '24 h', en: '24 h', es: '24 h' }], ['72', { fr: '3 jours', en: '3 days', es: '3 días' }], ['168', { fr: '1 semaine', en: '1 week', es: '1 semana' }]],
  unit: [['celsius', { fr: '°C', en: '°C', es: '°C' }], ['fahrenheit', { fr: '°F', en: '°F', es: '°F' }]],
}

// Debounced fetch of suggestions for what is typed
function useSuggest<X>(url: (q: string) => string | null, q: string, delay = 250) {
  const [items, setItems] = useState<X[]>([])
  const ticket = useRef(0)
  useEffect(() => {
    const u = url(q)
    if (!u) { setItems([]); return }
    const my = ++ticket.current
    const id = setTimeout(() => api.get<X[]>(u).then((r) => { if (my === ticket.current) setItems(Array.isArray(r) ? r : []) }).catch(() => my === ticket.current && setItems([])), delay)
    return () => clearTimeout(id)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  return items
}

const Seg = ({ options, value, onChange, lang }: { options: [string, L3][]; value: string; onChange: (v: string) => void; lang: Lang }) => (
  <div className="pf-seg" role="radiogroup">{options.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l[lang]}</button>)}</div>
)
function Range({ min, max, value, onChange, unit }: { min: number; max: number; value: number; onChange: (v: string) => void; unit: string }) {
  return <div className="pf-range"><input type="range" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} /><b>{value} {unit}</b></div>
}
const List = ({ children }: { children: ReactNode }) => <div className="pf-list" role="listbox">{children}</div>
// A listbox option that also works from the keyboard (Tab to reach it, Enter/Space to pick it) — plain
// divs with only onClick are invisible to keyboard-only and screen-reader users.
function Opt({ selected, onSelect, className = '', children }: { selected?: boolean; onSelect: () => void; className?: string; children: ReactNode }) {
  return (
    <div role="option" aria-selected={!!selected} tabIndex={0} className={`${selected ? 'on' : ''} ${className}`.trim()}
      onClick={onSelect} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}>
      {children}
    </div>
  )
}

// ---------- one control per kind of setting ----------
function FeedPicker({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: Lang }) {
  const [feeds, setFeeds] = useState<{ value: string; label: string; category: string }[]>([])
  const [cat, setCat] = useState('news')
  useEffect(() => { api.get<typeof feeds>('/services/rss/feeds').then(setFeeds).catch(() => {}) }, [])
  const cats = [...new Set(feeds.map((f) => f.category))]
  const host = (u: string) => { try { return new URL(u).hostname } catch { return '' } }
  return (
    <>
      {cats.length > 0 && <div className="pf-chips">{cats.map((c) => <button key={c} type="button" className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{CATS[c]?.[lang] ?? c}</button>)}</div>}
      <div className="pf-feeds">{feeds.filter((f) => f.category === cat).map((f) => (
        <button key={f.value} type="button" className={f.value === value ? 'on' : ''} onClick={() => onChange(f.value)}>
          <img src={`https://www.google.com/s2/favicons?domain=${host(f.value)}&sz=64`} alt="" /><span>{f.label.replace(' — ', ' · ')}</span>
        </button>
      ))}</div>
      <small>{T.orPaste[lang]}</small>
      <input className="pf-in" value={value} placeholder="https://…/rss.xml" onChange={(e) => onChange(e.target.value)} />
    </>
  )
}

function CryptoPicker({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: Lang }) {
  const [q, setQ] = useState('')
  const [typing, setTyping] = useState(false)
  const [pickedLabel, setPickedLabel] = useState('')
  const found = useSuggest<{ value: string; label: string }>((s) => (s.trim().length >= 2 ? `/services/market_data/assets?kind=crypto&q=${encodeURIComponent(s.trim())}&limit=8` : null), q)
  // The box shows the chosen coin until the user starts typing again
  const chosen = POPULAR.find(([id]) => id === value)
  const shown = typing ? q : chosen ? `${chosen[1]} (${chosen[2]})` : pickedLabel || value
  const pick = (id: string, label = '') => { onChange(id); setPickedLabel(label); setTyping(false); setQ('') }
  const needle = (typing ? q : '').trim().toLowerCase()
  const popular = POPULAR.filter(([id, n, t]) => !needle || `${id} ${n} ${t}`.toLowerCase().includes(needle))
  const rest = found.filter((f) => !popular.some(([id]) => id === f.value))
  return (
    <>
      <input className="pf-in pf-search" value={shown} placeholder="Bitcoin, ETH…" onFocus={(e) => e.target.select()} onChange={(e) => { setTyping(true); setQ(e.target.value) }} />
      <List>
        {popular.map(([id, n, t, g, c]) => <Opt key={id} selected={value === id} onSelect={() => pick(id)}><span className="pf-coin" style={{ background: c }}>{g}</span>{n}<small>{t}</small></Opt>)}
        {rest.map((f) => <Opt key={f.value} selected={value === f.value} onSelect={() => pick(f.value, f.label)}><span className="pf-coin">🪙</span>{f.label}</Opt>)}
        {!popular.length && !rest.length && <div className="pf-empty">{T.none[lang]}</div>}
      </List>
    </>
  )
}

function FiatPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [fiat, setFiat] = useState<{ value: string }[]>([])
  useEffect(() => { api.get<{ value: string }[]>('/services/market_data/assets?kind=fiat&limit=40').then(setFiat).catch(() => {}) }, [])
  const codes = [...new Set(['eur', 'usd', 'xof', 'gbp', ...fiat.map((f) => f.value)])]
  return <div className="pf-chips">{codes.map((c) => <button key={c} type="button" className={c === value ? 'on' : ''} onClick={() => onChange(c)}>{FIAT_COUNTRY[c] ? flagOf(FIAT_COUNTRY[c]) : '💱'} {c.toUpperCase()}</button>)}</div>
}

function RepoPicker({ value, onChange, lang, linked }: { value: string; onChange: (v: string) => void; lang: Lang; linked: boolean }) {
  const [repos, setRepos] = useState<{ value: string; label: string }[]>([])
  const [q, setQ] = useState('')
  useEffect(() => { if (linked) api.get<typeof repos>('/services/github/repos').then(setRepos).catch(() => {}) }, [linked])
  const shown = repos.filter((r) => !q || r.value.toLowerCase().includes(q.toLowerCase())).slice(0, 30)
  return (
    <>
      {linked ? (
        <>
          <small>{T.yourRepos[lang]}</small>
          <input className="pf-in pf-search" value={q} placeholder={T.search[lang]} onChange={(e) => setQ(e.target.value)} />
          <List>{shown.map((r) => <Opt key={r.value} selected={value === r.value} onSelect={() => onChange(r.value)}>📁 {r.label}</Opt>)}
            {!shown.length && <div className="pf-empty">{T.none[lang]}</div>}</List>
        </>
      ) : <small>{T.notLinked[lang]}</small>}
      <small>{T.known[lang]}</small>
      <div className="pf-chips">{KNOWN_REPOS.map((r) => <button key={r} type="button" className={r === value ? 'on' : ''} onClick={() => onChange(r)}>{r}</button>)}</div>
      <input className="pf-in" value={value} placeholder="propriétaire/nom ou https://github.com/…" onChange={(e) => onChange(e.target.value)} />
    </>
  )
}

function CityField({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: Lang }) {
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  const found = useSuggest<{ value: string; label: string }>((s) => (open && s.trim().length >= 2 ? `/services/weather/cities?q=${encodeURIComponent(s.trim())}&lang=${lang}&limit=6` : null), q)
  return (
    <div className="pf-pop">
      <input className="pf-in pf-search" value={q} placeholder="Cotonou, Paris…" onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); onChange(e.target.value) }} />
      {open && found.length > 0 && (
        <List>{found.map((c, i) => {
          const select = () => { setQ(c.value); onChange(c.value); setOpen(false) }
          // onMouseDown (not onClick) so the option is picked before the input's onBlur closes the list;
          // tabIndex/onKeyDown give the same option to keyboard users, who never trigger that blur race.
          return <div key={i} role="option" aria-selected={false} tabIndex={0}
            onMouseDown={(e) => { e.preventDefault(); select() }} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select())}>📍 {c.label}</div>
        })}</List>
      )}
    </div>
  )
}

function CountryPicker({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: Lang }) {
  const [q, setQ] = useState('')
  const found = useSuggest<{ value: string; label: string }>((s) => (s.trim().length >= 2 ? `/services/youtube/countries?q=${encodeURIComponent(s.trim())}&lang=${lang}&limit=6` : null), q)
  return (
    <>
      <div className="pf-flags">{TOP_COUNTRIES.map((c) => <button key={c} type="button" className={c === value.toUpperCase() ? 'on' : ''} onClick={() => onChange(c)}>{flagOf(c)}<small>{c}</small></button>)}</div>
      <input className="pf-in pf-search" value={q} placeholder={T.otherCountry[lang]} onChange={(e) => setQ(e.target.value)} />
      {found.length > 0 && <List>{found.map((c) => <Opt key={c.value} selected={value.toUpperCase() === c.value} onSelect={() => { onChange(c.value); setQ('') }}>{flagOf(c.value)} {c.label}</Opt>)}</List>}
    </>
  )
}

// Type-ahead for the "channel" field: only from 3 characters, and a long debounce — the backend's
// /services/youtube/channels endpoint spends real, shared YouTube quota per new search (see its comment).
// The field stays a plain input the whole time: pasting a full link or @handle directly still works.
function ChannelPicker({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: Lang }) {
  const found = useSuggest<{ value: string; label: string; subscribers: number | null }>(
    (s) => (s.trim().length >= 3 && !/^(https?:\/\/|@)/i.test(s.trim()) ? `/services/youtube/channels?q=${encodeURIComponent(s.trim())}&limit=8` : null),
    value,
    600,
  )
  return (
    <>
      <input className="pf-in" value={value} placeholder="@Squeezie" onChange={(e) => onChange(e.target.value)} />
      <small>{T.channelHint[lang]}</small>
      {found.length > 0 && (
        <List>
          {found.map((c) => (
            <Opt key={c.value} selected={c.value === value} onSelect={() => onChange(c.value)}>
              {c.label}{c.subscribers != null && <small> · {compact(c.subscribers, lang)} {W[lang].subscribers}</small>}
            </Opt>
          ))}
        </List>
      )}
    </>
  )
}

const youtubeId = (s: string) => s.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(s.trim()) ? s.trim() : null)

function CalendarField({ value, onChange, lang, editing }: { value: string; onChange: (v: string) => void; lang: Lang; editing: boolean }) {
  const [where, setWhere] = useState<'google' | 'outlook' | 'apple'>('google')
  const v = value.trim(), ok = /^(https?|webcal):\/\/.+/i.test(v) && /(\.ics|ical|calendar)/i.test(v)
  return (
    <>
      <small>{T.whereCal[lang]}</small>
      <div className="pf-seg">{(['google', 'outlook', 'apple'] as const).map((k) => <button key={k} type="button" className={k === where ? 'on' : ''} onClick={() => setWhere(k)}>{k === 'google' ? 'Google' : k === 'outlook' ? 'Outlook' : 'Apple'}</button>)}</div>
      <ol className="pf-steps">{CAL_STEPS[where].map((s, i) => <li key={i}>{s[lang]}</li>)}</ol>
      <input className="pf-in" type="password" value={value} placeholder={editing ? '••••••••' : 'https://calendar.google.com/…/basic.ics'} autoComplete="off"
        onChange={(e) => onChange(e.target.value.replace(/^webcal:\/\//i, 'https://'))} />
      {v && <small className={ok ? 'pf-ok' : 'pf-bad'}>{ok ? `✓ ${T.icsOk[lang]} 🔒` : T.icsBad[lang]}</small>}
      {editing && !v && <small>{T.secretKept[lang]}</small>}
      <small>{T.publicCal[lang]}</small>
      <div className="pf-chips"><button type="button" onClick={() => onChange(HOLIDAYS.bj)}>🇧🇯 {T.bj[lang]}</button><button type="button" onClick={() => onChange(HOLIDAYS.fr)}>🇫🇷 {T.fr[lang]}</button></div>
    </>
  )
}

interface Inspection { values: { path: string; label: string; sample: string }[]; lists: { path: string; label: string }[] }
function JsonExplorer({ url, listPath, pick, value, onChange, lang }: { url: string; listPath?: string; pick: 'value' | 'list' | 'field'; value: string; onChange: (v: string) => void; lang: Lang }) {
  const [data, setData] = useState<Inspection | null>(null), [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!/^https?:\/\//i.test(url.trim()) || (pick === 'field' && !listPath)) { setData(null); return }
    setBusy(true)
    const id = setTimeout(() => {
      const qs = new URLSearchParams({ url: url.trim(), ...(pick === 'field' && listPath ? { path: listPath } : {}) })
      api.get<Inspection>(`/services/custom_api/inspect?${qs}`).then(setData).catch(() => setData(null)).finally(() => setBusy(false))
    }, 500)
    return () => clearTimeout(id)
  }, [url, listPath, pick])
  const rows = pick === 'list' ? (data?.lists ?? []).map((l) => ({ path: l.path, label: `▾ ${l.label}`, sample: '' })) : (data?.values ?? [])
  return (
    <>
      <input className="pf-in" value={value} placeholder="data.items[0].price" onChange={(e) => onChange(e.target.value)} />
      {busy ? <small>{T.reading[lang]}</small> : rows.length > 0 ? (
        <>
          <small>{pick === 'list' ? T.pickList[lang] : pick === 'field' ? T.pickField[lang] : T.pickValue[lang]}</small>
          <div className="pf-tree" role="listbox">{rows.slice(0, 30).map((r) => (
            <Opt key={r.path} selected={r.path === value} onSelect={() => onChange(r.path)}><span className="k">{r.label}</span>{r.sample !== '' && <>: <span className="v">{String(r.sample).slice(0, 40)}</span></>}</Opt>
          ))}</div>
        </>
      ) : url.trim() && data ? <small>{T.noJson[lang]}</small> : null}
    </>
  )
}

// ---------- the form ----------
export function SignSelect({ value, lang, onChange }: { value: string; lang: Lang; onChange: (v: string) => void }) {
  return (
    <select className="dw-select" value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="" disabled>—</option>
      {Object.entries(ZODIAC).map(([k, z]) => <option key={k} value={k}>{z.glyph}{'︎'} {z.name[lang]}</option>)}
    </select>
  )
}

export function ParamFields({ entry, params, cfg, setCfg, lang, user, editing = false }: {
  entry: CatalogEntry
  params: WidgetParam[]
  cfg: Cfg
  setCfg: (updater: (c: Cfg) => Cfg) => void
  lang: Lang
  user: User
  editing?: boolean
}) {
  const w = entry.widget
  const set = (name: string) => (v: string) => setCfg((c) => ({ ...c, [name]: v }))
  const control = (p: WidgetParam): ReactNode => {
    const v = cfg[p.name] ?? '', key = `${w}.${p.name}`, onChange = set(p.name)
    const ex = entry.hints[p.name]?.[1] ?? ''
    if (w === 'horoscope' && p.name === 'sign') return <SignSelect value={v} lang={lang} onChange={onChange} />
    if (w === 'article_list' && p.name === 'link') return <FeedPicker value={v} onChange={onChange} lang={lang} />
    if ((w === 'exchange_rate' && p.name === 'base') || (w === 'price_history' && p.name === 'asset')) return <CryptoPicker value={v} onChange={onChange} lang={lang} />
    if ((w === 'exchange_rate' && p.name === 'quote') || (w === 'price_history' && p.name === 'currency')) return <FiatPicker value={v} onChange={onChange} />
    if (entry.service === 'github' && p.name === 'repo') return <RepoPicker value={v} onChange={onChange} lang={lang} linked={user.githubLinked} />
    if (entry.service === 'weather' && p.name === 'city') return <CityField value={v} onChange={onChange} lang={lang} />
    if (w === 'trending' && p.name === 'country') return <CountryPicker value={v} onChange={onChange} lang={lang} />
    if (entry.service === 'youtube' && p.name === 'channel') return <ChannelPicker value={v} onChange={onChange} lang={lang} />
    if (w === 'upcoming_events' && p.name === 'url') return <CalendarField value={v} onChange={onChange} lang={lang} editing={editing} />
    if (entry.service === 'custom_api' && p.name === 'path') return <JsonExplorer url={cfg.url ?? ''} pick={w === 'json_list' ? 'list' : 'value'} value={v} onChange={onChange} lang={lang} />
    if (entry.service === 'custom_api' && (p.name === 'titleField' || p.name === 'subtitleField')) return <JsonExplorer url={cfg.url ?? ''} listPath={cfg.path} pick="field" value={v} onChange={onChange} lang={lang} />
    // "unit" is only ever °C/°F for the weather service — custom_api's own "unit" param is free text
    // (e.g. "personnes", "$"), so it must not be forced into that same segmented picker.
    if (SEGMENTS[key] || (entry.service === 'weather' && p.name === 'unit')) {
      const opts = SEGMENTS[key] ?? SEGMENTS.unit
      return <Seg options={opts} value={v || (entry.service === 'weather' ? 'celsius' : ex)} onChange={onChange} lang={lang} />
    }
    if (p.type === 'integer' && RANGES[key]) {
      const [min, max] = RANGES[key]
      const n = Number(v || ex || min), c = COUNTS[key]
      return <Range min={min} max={max} value={n} onChange={onChange} unit={c ? (n === 1 ? c[1] : c[2])[lang] : paramLabel(p.name, lang).toLowerCase()} />
    }
    if (w === 'video_stats' && p.name === 'video') {
      const id = youtubeId(v)
      return (
        <>
          <input className="pf-in" value={v} placeholder="https://youtu.be/…" onChange={(e) => onChange(e.target.value)} />
          {id && <div className="pf-yt"><img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" referrerPolicy="no-referrer" /><small className="pf-ok">✓ {T.videoOk[lang]}</small></div>}
        </>
      )
    }
    // Plain field (secrets stay hidden; in the edit window an empty secret keeps the stored one)
    return (
      <>
        <input className="pf-in" type={p.type === 'integer' ? 'number' : p.secret ? 'password' : 'text'} value={v} autoComplete="off"
          placeholder={p.secret && editing ? '••••••••' : ex} onChange={(e) => onChange(e.target.value)} />
        {p.secret && editing && <small>{T.secretKept[lang]}</small>}
        {!p.secret && !editing && entry.hints[p.name] && <small>{entry.hints[p.name][0][lang]}{ex ? `, ${W[lang].eg} ${ex}` : ''}</small>}
      </>
    )
  }
  return (
    <>
      {params.map((p) => (
        <div key={p.name} className="dw-field pf-field">
          <span className="pf-label">{COUNTS[`${entry.widget}.${p.name}`]?.[0][lang] ?? paramLabel(p.name, lang)}{p.required ? ' *' : ''}{p.secret ? ' 🔒' : ''}</span>
          {control(p)}
        </div>
      ))}
    </>
  )
}
