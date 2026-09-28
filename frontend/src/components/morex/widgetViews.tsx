import { useEffect, useId, useState, type ReactNode } from 'react'
import { LOCALE, W, tr, type Lang } from '../../lib/i18n'
import { CURRENCY, ago, compact, flagOf, hostOf, initials, num, useNow } from '../../lib/format'
import { ZODIAC } from '../../lib/catalog'

// One component per card design of the mockup. Each receives what the backend stored for the
// widget: `data` = cachedData (the service's answer), `insight` = the AI enrichment (or null).

export interface ViewProps {
  data: unknown
  insight: unknown
  config: Record<string, string | number>
  lang: Lang
  title: string | null // title chosen by the user in the edit modal, if any
  footer?: ReactNode // "Every 5 min · 14:32", when the design has one
  onConfig?: (patch: Record<string, string | number>) => void // in-card controls (fx period)
}

type Any = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const obj = (v: unknown): Any => (v && typeof v === 'object' ? (v as Any) : {})
const arr = (v: unknown): Any[] => (Array.isArray(v) ? v : [])

const Waiting = ({ lang }: { lang: Lang }) => <div className="muted" style={{ margin: 'auto', fontSize: 13, textAlign: 'center' }}>{W[lang].waiting}</div>

const AiStar = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" /></svg>
const GithubLogo = () => (
  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }} fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55v-2.12c-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .3.21.66.79.55A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" /></svg>
)
const YtLogo = () => <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}><rect x="1.5" y="5" width="21" height="14" rx="4" fill="#ff0033" /><path d="M10 9v6l5-3z" fill="#fff" /></svg>

function Head({ icon, title, sub, iconClass = '' }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; iconClass?: string }) {
  return (
    <div className="w-head">
      <div className={`w-ico ${iconClass}`}>{icon}</div>
      <div style={{ minWidth: 0 }}><div className="w-title">{title}</div>{sub != null && <div className="w-sub">{sub}</div>}</div>
    </div>
  )
}

const sparkPath = (vals: number[], w: number, h: number, pd = 6) => {
  const mn = Math.min(...vals), mx = Math.max(...vals), span = mx - mn || 1
  return vals.map((v, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, vals.length - 1)) * w} ${h - pd - ((v - mn) / span) * (h - 2 * pd)}`).join(' ')
}

// ---------- RSS: newspaper + AI recap ----------
export function RssView({ data, insight, config, lang, title }: ViewProps) {
  const items = arr(data), w = W[lang]
  if (!items.length) return <Waiting lang={lang} />
  const lead = items[0]
  const ai = arr(obj(insight).items).find((x) => x.link === lead.link)
  const feed = (title || lead.feedTitle || hostOf(config.link) || 'RSS').split(/ [-–—|] /)[0]
  const image = lead.image ?? ai?.image
  const recap = ai?.summary || lead.summary
  return (
    <div className="np">
      <div className="mast">{feed}</div>
      <div className="sub">
        <span>{new Date().toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        {ai && <span className="ai"><AiStar />{w.aiRecap}</span>}
      </div>
      <div className="cols">
        <a className="lead" href={lead.link} target="_blank" rel="noopener noreferrer">
          {image && <div className="img"><img src={image} alt="" referrerPolicy="no-referrer" />{/en direct|live|en vivo/i.test(lead.title) && <span className="live">● {w.live}</span>}</div>}
          <h3>{lead.title}</h3>
          {recap && <><div className="kicker">{w.essential}</div><div className="recap">{recap}</div></>}
          {ai?.whyItMatters && <div className="why">{ai.whyItMatters}</div>}
          <div className="tags">
            {arr(ai?.topics).map((t) => <span key={String(t)}>{String(t)}</span>)}
            {ai?.readingMinutes && <span>{ai.readingMinutes} {w.readMin}</span>}
            {lead.publishedAt && <span>{ago(lead.publishedAt, lang)}</span>}
          </div>
        </a>
        <div className="side">
          {items.slice(1).map((a, i) => (
            <a key={a.link ?? i} href={a.link} target="_blank" rel="noopener noreferrer"><b>{a.title}</b>{a.summary && <small>{a.summary}</small>}</a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Market: exchange rate as a trading card with 24h / 7d / 30d tabs ----------
const TICK: Record<string, string> = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', dogecoin: 'DOGE', ripple: 'XRP', cardano: 'ADA', litecoin: 'LTC' }
export function FxView({ data, config, lang, onConfig }: ViewProps) {
  const d = obj(data), w = W[lang], gid = useId().replace(/:/g, '')
  // The tab shows the chosen period right away; the curve follows at the backend's next refresh
  const [period, setPeriod] = useState(String(config.days ?? d.days ?? 7))
  useEffect(() => setPeriod(String(config.days ?? d.days ?? 7)), [config.days, d.days])
  const hist = arr(d.history)
  if (!hist.length || d.rate == null) return <Waiting lang={lang} />
  const vals = hist.map((p) => Number(p.rate ?? p.price)), up = Number(d.changePct) >= 0, color = up ? '#34d399' : '#f87171'
  const path = sparkPath(vals, 300, 90)
  const base = String(d.base ?? config.base ?? ''), quote = String(d.quote ?? config.quote ?? '')
  const loading = d.days != null && String(d.days) !== period
  return (
    <div className="trade">
      <div className="row1">
        <span className="pair">{TICK[base] ?? base.slice(0, 3).toUpperCase()}/{quote.toUpperCase()}</span>
        <span className="periods" role="radiogroup">
          {['1', '7', '30'].map((v, i) => (
            <button key={v} type="button" role="radio" aria-checked={v === period} className={v === period ? 'on' : ''}
              onClick={(e) => { e.stopPropagation(); setPeriod(v); onConfig?.({ days: Number(v) }) }}>{w.periods[i]}</button>
          ))}
        </span>
      </div>
      <div className="price"><b>{num(Number(d.rate), lang)}</b><span style={{ color, fontWeight: 700 }}>{up ? '+' : ''}{Number(d.changePct).toFixed(2)}%</span></div>
      {/* Dimmed until the backend has fetched the newly chosen period */}
      <svg viewBox="0 0 300 90" preserveAspectRatio="none" role="img" style={{ opacity: loading ? 0.35 : 1, transition: 'opacity .3s' }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".38" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={`${path} L300 90 L0 90Z`} fill={`url(#${gid})`} /><path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="hl"><span>L {num(Number(d.min), lang)}</span><span>H {num(Number(d.max), lang)}</span></div>
    </div>
  )
}

// ---------- Market: price history with the spinning coin ----------
const COIN: Record<string, string> = { bitcoin: '₿', ethereum: 'Ξ', solana: '◎', dogecoin: 'Ð', litecoin: 'Ł' }
export function PriceView({ data, config, lang, title }: ViewProps) {
  const pts = arr(data), w = W[lang], gid = useId().replace(/:/g, '')
  if (pts.length < 2) return <Waiting lang={lang} />
  const pv = pts.map((p) => Number(p.price)), chg = ((pv.at(-1)! - pv[0]) / pv[0]) * 100, line = sparkPath(pv, 300, 110)
  const asset = String(config.asset ?? 'bitcoin'), cur = String(config.currency ?? 'usd').toLowerCase()
  const days = Number(config.days) || Math.max(1, Math.round((new Date(pts.at(-1)!.timestamp).getTime() - new Date(pts[0].timestamp).getTime()) / 864e5))
  return (
    <>
      <div className="bt-row">
        <div className="coin">{COIN[asset] ?? asset.charAt(0).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div className="w-title">{title || asset.charAt(0).toUpperCase() + asset.slice(1)} <span className="delta" style={{ color: chg >= 0 ? undefined : '#fca5a5' }}>{chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(1)} %</span></div>
          <div className="bt-price">{num(pv.at(-1)!, lang)} {CURRENCY[cur] ?? cur.toUpperCase()}</div>
        </div>
      </div>
      <svg className="bt-chart" viewBox="0 0 300 110" preserveAspectRatio="none" role="img">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f59e0b" stopOpacity=".4" /><stop offset="1" stopColor="#f59e0b" stopOpacity="0" /></linearGradient></defs>
        <path d={`${line} L300 110 L0 110Z`} fill={`url(#${gid})`} /><path d={line} fill="none" stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="w-sub">{w.lastDays(days)}</div>
    </>
  )
}

// ---------- GitHub: latest commits typed in a terminal ----------
export function TermView({ data, config, lang, title }: ViewProps) {
  const commits = arr(data)
  const repo = String(config.repo ?? ''), name = repo.split('/').pop() || 'repo'
  const lines: ReactNode[] = [
    <><span className="p">morex@{name}</span>:~$ git log --oneline</>,
    ...commits.map((c) => <><span className="h">{c.sha}</span> {c.message}</>),
    <><span className="p">morex@{name}</span>:~$ </>,
  ]
  const [step, setStep] = useState(1)
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s % (lines.length + 3)) + 1), 900)
    return () => clearInterval(id)
  }, [lines.length])
  return (
    <>
      <div className="term-bar"><i style={{ background: '#f87171' }} /><i style={{ background: '#fbbf24' }} /><i style={{ background: '#4ade80' }} /><span>{title || repo}</span></div>
      {commits.length ? (
        <pre className="term">
          {lines.slice(0, Math.min(step, lines.length)).map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>)}
          <span className="cur" />
        </pre>
      ) : <Waiting lang={lang} />}
    </>
  )
}

// ---------- GitHub: open issues as pinned post-its ----------
export function IssuesView({ data, config, lang, title, footer }: ViewProps) {
  const issues = arr(data), repo = String(config.repo ?? '')
  return (
    <>
      <Head icon={<GithubLogo />} title={title || (lang === 'fr' ? 'Issues ouvertes' : lang === 'es' ? 'Issues abiertas' : 'Open issues')} sub={repo} />
      <div className="postits">
        {data == null ? <Waiting lang={lang} /> : !issues.length ? <div className="muted" style={{ margin: 'auto', fontSize: 13 }}>{W[lang].noIssues}</div> :
          issues.map((i) => (
            <a key={i.number} className="postit" href={`https://github.com/${repo}/issues/${i.number}`} target="_blank" rel="noopener noreferrer">
              <b>{i.title}</b><small>#{i.number} · {i.author} · {ago(i.createdAt, lang)}</small>
            </a>
          ))}
      </div>
      {footer}
    </>
  )
}

// ---------- GitHub: repo stats on a starry sky ----------
export function StatsView({ data, config, lang, title }: ViewProps) {
  const d = obj(data), w = W[lang]
  return (
    <>
      <div className="stars-bg" aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => <i key={i} style={{ left: `${(i * 41) % 96}%`, top: `${(i * 29) % 90}%`, fontSize: 7 + (i % 4) * 3, animationDelay: `-${i * 0.3}s` }}>★</i>)}
      </div>
      <Head icon={<GithubLogo />} title={title || (lang === 'fr' ? 'Statistiques' : lang === 'es' ? 'Estadísticas' : 'Stats')} sub={String(config.repo ?? '')} />
      {d.stars == null ? <Waiting lang={lang} /> : (
        <>
          <div className="odo">
            {Number(d.stars).toLocaleString(LOCALE[lang]).split('').map((ch, i) => (/\d/.test(ch) ? <span key={i} style={{ animationDelay: `${i * 0.08}s` }}>{ch}</span> : <span key={i} className="sep" />))}
          </div>
          <div className="odo-lbl">{w.stars}</div>
          <div className="w-sub" style={{ textAlign: 'center', marginTop: 'auto' }}>🍴 {compact(d.forks, lang)} forks · 🐞 {compact(d.openIssues, lang)} issues</div>
        </>
      )}
    </>
  )
}

// ---------- GitHub: what changed, as a notebook page + AI stand-up ----------
const PASTEL = ['#f9a8d4', '#93c5fd', '#fde68a', '#c4b5fd', '#86efac', '#fdba74']
const colorOf = (n: string) => PASTEL[[...n].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PASTEL.length]
export function DailyView({ data, insight, config, lang, title }: ViewProps) {
  const d = obj(data), w = W[lang], standup = String(obj(insight).summary ?? '')
  const hours = Number(d.hours ?? config.hours ?? 24)
  return (
    <>
      <Head icon={<GithubLogo />} iconClass="gh-ico" title={title || (lang === 'fr' ? 'Carnet de bord' : lang === 'es' ? 'Cuaderno de bitácora' : 'Logbook')} sub={`${d.repo ?? config.repo ?? ''} · ${hours} h`} />
      {data == null ? <Waiting lang={lang} /> : (
        <div className="logbook">
          <div className="left">
            <div className="count"><b>{d.commitCount ?? 0}</b><span>{w.commitsIn(hours)}</span></div>
            <div className="people">{arr(d.authors).map((a) => <i key={a.name} style={{ background: colorOf(a.name) }} title={`${a.name} · ${a.count}`}>{initials(a.name)}</i>)}</div>
            {standup && <><span className="ai"><AiStar />{w.standup}</span><div className="sum">{standup}</div></>}
          </div>
          <ul>
            {!arr(d.commits).length && <li style={{ display: 'block', color: '#8a7d70', fontSize: 13 }}>{w.noCommits}</li>}
            {arr(d.commits).slice(0, 5).map((c) => (
              <li key={c.sha}>
                <i style={{ background: colorOf(c.author) }}>{initials(c.author)}</i>
                <div className="msg"><div>{String(c.message).replace(/\s*\(#\d+\)$/, '')}</div><small>{c.author} · {ago(c.date, lang)}</small></div>
                <span className="sha">{c.sha}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

// ---------- World clock: 24 h timeline ----------
const FLAGS: Record<string, string> = {
  'Europe/Paris': '🇫🇷', 'America/New_York': '🇺🇸', 'America/Los_Angeles': '🇺🇸', 'America/Chicago': '🇺🇸', 'Asia/Tokyo': '🇯🇵', 'America/Toronto': '🇨🇦', 'America/Montreal': '🇨🇦',
  'Asia/Dubai': '🇦🇪', 'Europe/London': '🇬🇧', 'Europe/Madrid': '🇪🇸', 'Europe/Berlin': '🇩🇪', 'Europe/Rome': '🇮🇹', 'Europe/Brussels': '🇧🇪', 'Africa/Porto-Novo': '🇧🇯',
  'Africa/Lagos': '🇳🇬', 'Africa/Abidjan': '🇨🇮', 'Africa/Dakar': '🇸🇳', 'Africa/Casablanca': '🇲🇦', 'Africa/Johannesburg': '🇿🇦', 'Asia/Shanghai': '🇨🇳', 'Asia/Seoul': '🇰🇷',
  'Asia/Kolkata': '🇮🇳', 'Asia/Singapore': '🇸🇬', 'Australia/Sydney': '🇦🇺', 'America/Sao_Paulo': '🇧🇷', 'America/Mexico_City': '🇲🇽', 'Pacific/Honolulu': '🇺🇸',
}
const labelOf = (tz: string) => (tz.split('/').pop() ?? tz).replace(/_/g, ' ')
function zoned(now: Date, tz: string) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23' })
      .formatToParts(now).map((x) => [x.type, x.value]))
    return { h: +p.hour, m: +p.minute, key: `${p.year}${p.month}${p.day}`, abs: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) }
  } catch {
    return null
  }
}
export function WorldView({ data, lang, title }: ViewProps) {
  const t = tr(lang), d = obj(data), now = useNow(30_000)
  const home = String(obj(d.home).timezone ?? '')
  const me = home ? zoned(now, home) : null
  // The backend gives the zones and a snapshot of their time; the card keeps ticking from those zones
  const rows = me ? [{ tz: home, label: String(obj(d.home).label ?? labelOf(home)), iso2: obj(d.home).iso2 as string | undefined, isMe: true }, ...arr(d.cities).map((c) => ({ tz: String(c.timezone), label: String(c.label ?? labelOf(c.timezone)), iso2: c.iso2 as string | undefined, isMe: false }))]
    .map((r) => {
      const c = zoned(now, r.tz)
      if (!c) return null
      const diff = Math.round(((c.abs - me.abs) / 36e5) * 2) / 2
      return { ...r, ...c, hm: `${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}`, isDay: c.h >= 6 && c.h < 18,
        off: r.isMe ? t.here : diff === 0 ? t.same : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} h`, day: c.key === me.key ? '' : c.key > me.key ? t.tomorrow : t.yesterday }
    }).filter((r): r is NonNullable<typeof r> => r !== null).sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m)) : []
  // Pins alternate above / below the bar. Labels on the same side that would overlap are spread apart
  // (the dot and stem stay at the real time, only the label slides)
  const at = rows.map((r) => Math.min(94, Math.max(6, ((r.h * 60 + r.m) / 1440) * 100)))
  const shift = at.map(() => 0), GAP = 15
  for (const side of [0, 1]) {
    const idx = at.map((_, i) => i).filter((i) => i % 2 === side)
    const x = idx.map((i) => at[i])
    for (let k = 1; k < x.length; k++) x[k] = Math.max(x[k], x[k - 1] + GAP)
    x[x.length - 1] = Math.min(x[x.length - 1] ?? 0, 94)
    for (let k = x.length - 2; k >= 0; k--) x[k] = Math.min(x[k], x[k + 1] - GAP)
    idx.forEach((i, k) => (shift[i] = x[k] - at[i]))
  }
  return (
    <>
      <Head icon={<svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>} title={title || t.worldTitle} sub={t.worldSub} />
      <div className="wl-line">
        <div className="bar" />
        <div className="hrs"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>
        {!rows.length && <Waiting lang={lang} />}
        {rows.map((r, i) => (
          <div key={r.tz} className={`wl-pin ${i % 2 ? 'down' : 'up'}${r.isMe ? ' me' : ''}`} style={{ left: `${at[i]}%` }}>
            <div className="lbl" style={shift[i] ? { position: 'relative', left: `${shift[i]}cqw` } : undefined}>{r.isMe ? '📍' : r.iso2 ? flagOf(r.iso2) : FLAGS[r.tz] ?? '🌐'} {r.label}<br /><b>{r.hm}</b> {r.isDay ? '☀️' : '🌙'}
              <small style={{ display: 'block', color: 'rgb(255 255 255 / .55)', fontSize: 10 }}>{r.off}{r.day ? ` · ${r.day}` : ''}</small></div>
            <div className="stem" /><div className="dot" />
          </div>
        ))}
      </div>
    </>
  )
}

// ---------- Weather ----------
const WXI: Record<string, string> = { clear: '☀️', partly_cloudy: '⛅', cloudy: '☁️', fog: '🌫️', drizzle: '🌦️', rain: '🌧️', snow: '❄️', thunderstorm: '⛈️' }
const deg = (unit: unknown) => (unit === 'fahrenheit' ? '°F' : '°')

export function WeekView({ data, lang, title }: ViewProps) {
  const d = obj(data), days = arr(d.days), w = W[lang], gid = useId().replace(/:/g, '')
  const head = <Head icon="📅" title={title || (lang === 'fr' ? 'Météo de la semaine' : lang === 'es' ? 'Tiempo de la semana' : 'Weekly weather')} sub={d.city ? `${d.city} · ${w.nDays(days.length)}` : undefined} />
  if (!days.length) return <>{head}<Waiting lang={lang} /></>
  const lo = Math.min(...days.map((x) => x.min)), span = Math.max(1, Math.max(...days.map((x) => x.max)) - lo)
  const y = (t: number) => 132 - ((t - lo) / span) * 92, x = (i: number) => 24 + (i * 252) / Math.max(1, days.length - 1)
  return (
    <>
      {head}
      <svg className="wx-bars" viewBox="0 0 300 190" role="img">
        <defs><linearGradient id={gid} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#fb923c" /></linearGradient></defs>
        {days.map((dd, i) => (
          <g key={dd.date}>
            <rect x={x(i) - 11} y={y(dd.max)} width="22" height={Math.max(8, y(dd.min) - y(dd.max))} rx="11" fill={`url(#${gid})`} />
            <text x={x(i)} y={y(dd.max) - 7} fill="#fff" fontSize="12" textAnchor="middle">{dd.max}°</text>
            <text x={x(i)} y={Math.max(y(dd.min), y(dd.max) + 8) + 15} fill="rgb(255 255 255 / .6)" fontSize="11" textAnchor="middle">{dd.min}°</text>
            <text x={x(i)} y="168" fontSize="16" textAnchor="middle">{WXI[dd.condition] ?? '☁️'}</text>
            <text x={x(i)} y="186" fill="rgb(255 255 255 / .7)" fontSize="10" textAnchor="middle">{new Date(`${dd.date}T12:00`).toLocaleDateString(LOCALE[lang], { weekday: 'short' }).replace('.', '')}</text>
          </g>
        ))}
      </svg>
    </>
  )
}

export function NowView({ data, insight, lang, title, footer }: ViewProps) {
  const c = obj(data), w = W[lang], adv = obj(insight)
  const cloudy = ['partly_cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'thunderstorm'].includes(c.condition)
  const outfit = String(adv.outfit ?? '').split(/[,;·•]|\s+(?:et|and|y)\s+/).map((s) => s.trim()).filter(Boolean)
  return (
    <>
      <Head icon={WXI[c.condition] ?? '⛅'} title={title || (lang === 'fr' ? 'Météo actuelle' : lang === 'es' ? 'Tiempo actual' : 'Current weather')} sub={c.city} />
      {c.temperature != null && (
        <div className={`sky-layer ${c.isDay ? 'sky-day' : 'sky-night'}`} aria-hidden="true">
          <span className="sky-orb" />
          {!c.isDay && Array.from({ length: 16 }, (_, i) => <i key={i} className="sky-star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 55}%`, animationDelay: `-${i * 0.3}s` }} />)}
          {cloudy && <><span className="sky-cloud" style={{ left: 16, top: 72 }}>☁️</span><span className="sky-cloud" style={{ left: 150, top: 40, fontSize: 30, animationDelay: '-5s' }}>☁️</span></>}
        </div>
      )}
      <div className="wx-now">
        {c.temperature == null ? <Waiting lang={lang} /> : (
          <>
            <div className="big">{c.temperature}{deg(c.unit)}</div>
            <div style={{ fontWeight: 600 }}>{w.wx[c.condition] ?? c.condition} · ↑{c.high}° ↓{c.low}°</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{w.feels} {c.feelsLike}° · 💧 {c.humidity} % · 💨 {c.windKmh} km/h</div>
            {adv.advice && (
              <div className="wx-advice"><div className="ai"><AiStar />{w.advice}</div>{adv.advice}
                {outfit.length > 0 && <div className="wear">{outfit.map((o) => <span key={o}>{o}</span>)}</div>}</div>
            )}
          </>
        )}
      </div>
      {footer}
    </>
  )
}

export function HoursView({ data, lang, title, footer }: ViewProps) {
  const d = obj(data), hours = arr(d.hours), w = W[lang]
  return (
    <>
      <Head icon="⛅" title={title || (lang === 'fr' ? 'Météo heure par heure' : lang === 'es' ? 'Tiempo por horas' : 'Hourly weather')} sub={d.city} />
      {!hours.length ? <Waiting lang={lang} /> : (
        <ul className="wx-chips">
          {hours.map((h, i) => {
            const hr = new Date(h.time).getHours(), day = hr >= 6 && hr < 19
            return <li key={h.time} className={i === 0 ? 'now' : ''}><span>{i === 0 ? w.nowShort : `${hr} h`}</span><span className="ic">{h.condition === 'clear' && !day ? '🌙' : WXI[h.condition]}</span><b>{h.temperature}°</b><span className="rain">💧{h.rainChance ?? 0}%</span></li>
          })}
        </ul>
      )}
      {footer}
    </>
  )
}

// ---------- Calendar: countdown to the next event ----------
function dayLabel(iso: string, lang: Lang) {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(iso).setHours(0, 0, 0, 0) - t.getTime()) / 864e5)
  return diff === 0 ? W[lang].today : diff === 1 ? W[lang].tomorrow : new Date(iso).toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' })
}
const hm = (iso: string, lang: Lang) => new Date(iso).toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' })
export function CalView({ data, config, lang, title }: ViewProps) {
  const w = W[lang], now = useNow(30_000)
  const all = arr(obj(data).events), E = all.filter((e) => new Date(e.end ?? e.start).getTime() > now.getTime())
  const head = <Head icon="📅" iconClass="cal-ico" title={title || 'Agenda'} sub={data == null ? undefined : `${w.events(all.length)} · ${config.days ?? 14} ${w.days}`} />
  if (data == null) return <>{head}<Waiting lang={lang} /></>
  if (!E.length) return <>{head}<div className="cd"><span className="cd-lbl">{w.nothing}</span></div></>
  const nx = E[0], ms = Math.max(0, new Date(nx.start).getTime() - now.getTime())
  const dd = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24, mm = Math.floor(ms / 6e4) % 60
  return (
    <>
      {head}
      <div className="cd">
        <span className="cd-lbl">{ms ? w.nextIn : w.happening}</span>
        <div className="units">
          <div><b>{dd}</b><span>{w.days}</span></div><div><b>{String(hh).padStart(2, '0')}</b><span>{w.hours}</span></div><div><b>{String(mm).padStart(2, '0')}</b><span>{w.min}</span></div>
        </div>
        <h3>{nx.title}</h3>
        <div className="w-sub">{dayLabel(nx.start, lang)}{nx.allDay ? '' : ` · ${hm(nx.start, lang)}`}{nx.location ? ` · 📍 ${nx.location}` : ''}</div>
        <div className="later">{E.slice(1, 3).map((e, i) => <div key={i}><span>{e.title}</span><span>{dayLabel(e.start, lang)}</span></div>)}</div>
      </div>
    </>
  )
}

// ---------- My Epitech: today's planning on an 8 h – 19 h ruler, and the profile ----------
export function PlanView({ data, lang, title }: ViewProps) {
  const w = W[lang], now = useNow(60_000), H0 = 8, H1 = 19
  const pos = (d: Date) => ((d.getHours() + d.getMinutes() / 60 - H0) / (H1 - H0)) * 100
  const today = arr(obj(data).events).filter((e) => !e.allDay && new Date(e.start).toDateString() === now.toDateString())
  const nowP = pos(now), cols = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6']
  return (
    <>
      <Head icon="EPI" iconClass="epi-ico" title={title || 'Planning'} sub={data == null ? undefined : w.activities(today.length)} />
      {data == null ? <Waiting lang={lang} /> : (
        <div className="epi-rail">
          {[8, 10, 12, 14, 16, 18].map((h) => <span key={h} className="hr" style={{ top: `${((h - H0) / (H1 - H0)) * 100}%` }}>{h} h</span>)}
          {!today.length && <span className="cd-lbl" style={{ position: 'absolute', left: 16, top: '46%', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', opacity: 0.65 }}>{w.noActivity}</span>}
          {today.map((e, i) => {
            const s = new Date(e.start), en = new Date(e.end ?? e.start), long = en.getTime() - s.getTime() > 36e5
            const top = Math.max(0, pos(s)), height = Math.max(0, Math.min(100, pos(en)) - top)
            return (
              <div key={i} className="blk" style={{ top: `${top}%`, height: `${height}%`, background: `${cols[i % 5]}22`, borderColor: cols[i % 5] }}>
                {long ? <><b>{e.title}</b>{hm(e.start, lang)}–{hm(e.end ?? e.start, lang)}{e.location ? ` · ${e.location}` : ''}</>
                  : <b>{e.title} <span style={{ fontWeight: 400, opacity: 0.75 }}>· {hm(e.start, lang)}</span></b>}
              </div>
            )
          })}
          {nowP > 0 && nowP < 100 && <div className="now" style={{ top: `${nowP}%` }} />}
        </div>
      )}
    </>
  )
}

export function ProfView({ data, lang, title }: ViewProps) {
  const P = obj(data), w = W[lang]
  return (
    <>
      <Head icon="EPI" iconClass="epi-ico" title={title || tr(lang).myProfile} sub="My Epitech" />
      {data == null ? <Waiting lang={lang} /> : (
        <div className="epi-prof">
          <div className="av"><div>{initials(String(P.name ?? P.login ?? '?'))}</div></div>
          <h3>{P.name ?? P.login}</h3>
          <div className="w-sub">{P.email ?? ''}</div>
          <div className="cells">
            <div><b>{P.campus ?? '—'}</b><span>{w.campus}</span></div>
            <div><b>{P.promotion ?? '—'}</b><span>{w.promo}</span></div>
            <div><b>{String(P.cursus ?? '—').split(' · ')[0]}</b><span>{w.cursus}</span></div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- Custom API: one value on an LCD screen, a list as a ranking ----------
export function ValueView({ data, lang, title }: ViewProps) {
  const V = obj(data), w = W[lang]
  useNow(30_000)
  return (
    <>
      <Head icon="{ }" iconClass="api-ico" title={title || V.label || w.customApi} sub={w.customApi} />
      {data == null ? <Waiting lang={lang} /> : (
        <>
          <div className="api-lcd"><div className="l">{V.label}</div><div className="v">{String(V.value)}{V.unit && <small>{V.unit}</small>}</div></div>
          <div className="api-leds"><i /><span>{w.liveAgo} · {ago(V.fetchedAt, lang)}</span></div>
        </>
      )}
    </>
  )
}

export function ListView({ data, lang, title }: ViewProps) {
  const items = arr(obj(data).items), w = W[lang]
  return (
    <>
      <Head icon="[ ]" iconClass="api-ico" title={title || w.myList} sub={data == null ? w.customApi : `${w.customApi} · ${w.items(items.length)}`} />
      {data == null ? <Waiting lang={lang} /> : (
        <ol className="api-rank">{items.map((x, i) => <li key={i}><div><b>{x.title}</b>{x.subtitle && <span>{x.subtitle}</span>}</div></li>)}</ol>
      )}
    </>
  )
}

// ---------- YouTube ----------
const YtImg = ({ src }: { src: string }) => <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" />
export function ChannelView({ data, config, lang, title, footer }: ViewProps) {
  const c = obj(data), w = W[lang]
  return (
    <>
      <Head icon={<YtLogo />} title={title || (lang === 'fr' ? 'Statistiques de la chaîne' : lang === 'es' ? 'Estadísticas del canal' : 'Channel stats')} sub={c.handle ?? config.channel} />
      {data == null ? <Waiting lang={lang} /> : (
        <div className="yt-channel">
          {c.avatar && <YtImg src={c.avatar} />}<div className="w-title">{c.title}</div>
          <div className="n">{Number(c.subscribers).toLocaleString(LOCALE[lang])}</div><div className="l">{w.subscribers}</div>
          <a href={c.url} target="_blank" rel="noopener noreferrer">{w.seeChannel}</a>
        </div>
      )}
      {footer}
    </>
  )
}

export function LatestView({ data, config, lang, title, footer }: ViewProps) {
  const vids = arr(data), w = W[lang]
  return (
    <>
      <Head icon={<YtLogo />} title={title || (lang === 'fr' ? 'Dernières vidéos' : lang === 'es' ? 'Últimos vídeos' : 'Latest videos')} sub={vids[0]?.channel ?? config.channel} />
      {!vids.length ? <Waiting lang={lang} /> : (
        <div className="yt-latest">
          {vids.map((x, i) => (
            <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer">
              <span className="th"><YtImg src={x.thumbnail} />{i === 0 && <span className="new">{w.newVideo}</span>}</span>
              <span className="yt-t">{x.title}</span><span className="yt-s">{compact(x.views, lang)} {w.views} · {ago(x.publishedAt, lang)}</span>
            </a>
          ))}
        </div>
      )}
      {footer}
    </>
  )
}

export function TrendView({ data, config, lang, title, footer }: ViewProps) {
  const vids = arr(data), w = W[lang], [story, setStory] = useState(0)
  useEffect(() => {
    if (!vids.length) return
    const id = setInterval(() => setStory((s) => (s + 1) % vids.length), 3500)
    return () => clearInterval(id)
  }, [vids.length])
  const x = vids[story % Math.max(1, vids.length)]
  return (
    <>
      <Head icon={<YtLogo />} title={title || (lang === 'fr' ? 'Tendances' : lang === 'es' ? 'Tendencias' : 'Trending')} sub={String(config.country ?? '').toUpperCase()} />
      {!x ? <Waiting lang={lang} /> : (
        <div className="yt-trend">
          <div className="bars">{vids.map((_, i) => <i key={`${i}-${i === story ? story : ''}`} className={i < story ? 'done' : i === story ? 'on' : ''} />)}</div>
          <a className="big" href={x.url} target="_blank" rel="noopener noreferrer"><YtImg src={x.thumbnail} />
            <span className="info"><span className="num">#{story + 1}</span><div className="yt-t" style={{ fontSize: 14 }}>{x.title}</div><div className="yt-s">{x.channel} · {compact(x.views, lang)} {w.views}</div></span></a>
        </div>
      )}
      {footer}
    </>
  )
}

export function VideoView({ data, lang, title, footer }: ViewProps) {
  const v = obj(data), w = W[lang]
  return (
    <>
      <Head icon={<YtLogo />} title={title || (lang === 'fr' ? 'Statistiques de la vidéo' : lang === 'es' ? 'Estadísticas del vídeo' : 'Video stats')} sub={v.channel ?? 'YouTube'} />
      {data == null ? <Waiting lang={lang} /> : (
        <div className="yt-video">
          <a className="th" href={v.url} target="_blank" rel="noopener noreferrer"><YtImg src={v.thumbnail} /></a>
          <div className="yt-t">{v.title}</div>
          <div className="counts"><div><b>{compact(v.views, lang)}</b>👁 {w.views}</div><div><b>{compact(v.likes, lang)}</b>👍 {w.likes}</div><div><b>{compact(v.comments, lang)}</b>💬 {w.comments}</div></div>
        </div>
      )}
      {footer}
    </>
  )
}

// ---------- Steam: player card, recent games "featured", library podium ----------
const SteamLogo = () => (
  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} fill="#c7d5e0"><path d="M12 2a10 10 0 0 0-9.96 9.08l5.36 2.22a2.83 2.83 0 0 1 1.6-.5h.16l2.38-3.45v-.05a3.77 3.77 0 1 1 3.77 3.77h-.09l-3.4 2.43v.13a2.83 2.83 0 0 1-5.6.57L2.4 14.66A10 10 0 1 0 12 2Zm-3.75 15.2-1.23-.51a2.13 2.13 0 1 0 1.17-2.93l1.27.53a1.57 1.57 0 1 1-1.2 2.91Zm9.2-7.9a2.51 2.51 0 1 0-2.5 2.52 2.51 2.51 0 0 0 2.5-2.51Zm-4.39 0a1.89 1.89 0 1 1 1.89 1.89 1.89 1.89 0 0 1-1.89-1.89Z" /></svg>
)
const hours = (m: unknown, lang: Lang) => Math.round(Number(m ?? 0) / 60).toLocaleString(LOCALE[lang])
export function SteamProfView({ data, lang }: ViewProps) {
  const P = obj(data), w = W[lang]
  if (!P.name) return <Waiting lang={lang} />
  const online = P.status !== 'offline'
  return (
    <a className="st-prof" href={P.url} target="_blank" rel="noopener noreferrer">
      <div className={`st-ring${online ? '' : ' off'}`}>{P.avatar && <img src={P.avatar} alt="" referrerPolicy="no-referrer" />}{P.level != null && <span className="st-lvl">{P.level}</span>}</div>
      <div className="st-name">{P.name}</div>
      <div className="w-sub">{w.steamStatus[P.status] ?? P.status}{P.country ? ` · ${flagOf(P.country)}` : ''}{P.memberSince ? ` · ${w.since} ${new Date(P.memberSince).getFullYear()}` : ''}</div>
      {P.currentGame && <div className="st-playing"><span className="st-dot" />{w.playing} {P.currentGame}</div>}
    </a>
  )
}
export function SteamRecentView({ data, lang, title }: ViewProps) {
  const G = arr(data), w = W[lang], top = G[0]
  return (
    <>
      <Head icon={<SteamLogo />} iconClass="st-ico" title={title || (lang === 'fr' ? 'Jeux récents' : lang === 'es' ? 'Juegos recientes' : 'Recent games')} sub={w.last2w} />
      {data == null ? <Waiting lang={lang} /> : !top ? <div className="muted" style={{ margin: 'auto', fontSize: 13 }}>{w.noRecent}</div> : (
        <>
          <a className="st-feat" href={top.url} target="_blank" rel="noopener noreferrer"><img src={top.header} alt="" referrerPolicy="no-referrer" />
            <span className="st-cap"><b>{top.name}</b><span>🔥 {hours(top.minutesLast2Weeks, lang)} h {w.this2w}</span></span></a>
          {G.length > 1 && <div className="st-thumbs">{G.slice(1, 4).map((g) => (
            <a key={g.appId} href={g.url} target="_blank" rel="noopener noreferrer" title={g.name}><img src={g.header} alt="" referrerPolicy="no-referrer" /><small>{hours(g.minutesLast2Weeks, lang)} h</small></a>
          ))}</div>}
        </>
      )}
    </>
  )
}
export function SteamLibView({ data, lang, title }: ViewProps) {
  const L = obj(data), w = W[lang], top = arr(L.topGames)
  // Podium order: 2nd, 1st, 3rd
  const podium = [top[1], top[0], top[2]].map((g, i) => g && { g, h: [70, 96, 54][i], medal: ['🥈', '🥇', '🥉'][i], color: ['#c0c7d0', '#e5b54a', '#cd7f32'][i] })
  return (
    <>
      <Head icon={<SteamLogo />} iconClass="st-ico" title={title || (lang === 'fr' ? 'Ma bibliothèque' : lang === 'es' ? 'Mi biblioteca' : 'My library')} sub={L.totalHours != null ? w.hTotal(Number(L.totalHours).toLocaleString(LOCALE[lang])) : undefined} />
      {!top.length ? <Waiting lang={lang} /> : (
        <div className="st-pod">
          {podium.map((p, i) => p && (
            <a key={i} href={p.g.url} target="_blank" rel="noopener noreferrer"><img src={p.g.header} alt="" referrerPolicy="no-referrer" /><small>{p.g.name}</small><b>{hours(p.g.minutesTotal, lang)} h</b>
              <span className="st-step" style={{ height: p.h, background: `linear-gradient(${p.color}, rgb(255 255 255 / .05))` }}>{p.medal}</span></a>
          ))}
        </div>
      )}
    </>
  )
}

// ---------- Well-being: quote typed like on a typewriter ----------
export function QuoteView({ data, lang, title }: ViewProps) {
  const Q = obj(data), w = W[lang], full = String(obj(Q.text)[lang] ?? '')
  const [n, setN] = useState(0)
  // Types the quote once, letter by letter, then the cursor keeps blinking
  useEffect(() => {
    setN(0)
    if (!full) return
    const id = setInterval(() => setN((k) => (k >= full.length ? (clearInterval(id), k) : k + 1)), 55)
    return () => clearInterval(id)
  }, [full])
  const date = Q.date ? new Date(`${Q.date}T12:00`).toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  return (
    <>
      <Head icon="⌨" title={title || w.quoteTitle} sub={date} />
      {!full ? <Waiting lang={lang} /> : (
        <>
          <div className="tw-text">{full.slice(0, n)}</div>
          <div className="tw-by">— {Q.author}</div>
        </>
      )}
    </>
  )
}

// ---------- Well-being: "did you know?" card that turns over to show the fact ----------
const TOPIC_ICON: Record<string, string> = { nature: '🌿', space: '🔭', science: '🧪', history: '🏛️', tech: '💻', body: '🫀' }
export function FactView({ data, lang, title }: ViewProps) {
  const F = obj(data), w = W[lang], [open, setOpen] = useState(false), text = obj(F.text)[lang]
  if (!text) return <Waiting lang={lang} />
  return (
    <div className={`fact${open ? ' open' : ''}`} role="button" tabIndex={0} aria-pressed={open}
      onClick={() => setOpen((o) => !o)} onKeyDown={(e) => e.key === 'Enter' && setOpen((o) => !o)}>
      <div className="fact-in">
        <div className="fact-face fact-front"><span className="bulb">💡</span><b>{title || w.factTitle}</b><small>{w.tapDiscover}</small></div>
        <div className="fact-face fact-back"><span className="chip">{TOPIC_ICON[F.topic] ?? '💡'} {w.topics[F.topic] ?? F.topic}</span><p>{text}</p></div>
      </div>
    </div>
  )
}

// ---------- Well-being: horoscope as a nebula card; tap it to turn it over and see the day in detail ----------
const AREAS: [string, string, 'love' | 'work' | 'energy'][] = [['❤', '#f472b6', 'love'], ['✎', '#38bdf8', 'work'], ['✺', '#fde047', 'energy']]
export function HoroView({ data, insight, lang }: ViewProps) {
  const H = obj(data), w = W[lang], [back, setBack] = useState(false)
  const sign = ZODIAC[String(H.sign)]
  if (!sign) return <Waiting lang={lang} />
  // With AI switched on, its freshly written text replaces the library sentence
  const ai = obj(insight)
  const msg = ai.source === 'ai' && ai.text ? String(ai.text) : obj(H.text)[lang]
  const dust = Array.from({ length: 22 }, (_, i) => <i key={i} style={{ left: `${(i * 43) % 100}%`, top: `${60 + ((i * 17) % 40)}%`, animationDelay: `-${(i * 0.7).toFixed(1)}s`, animationDuration: `${7 + (i % 5)}s` }} />)
  return (
    <div className={`horo${back ? ' open' : ''}`} role="button" tabIndex={0} aria-pressed={back}
      onClick={() => setBack((b) => !b)} onKeyDown={(e) => e.key === 'Enter' && setBack((b) => !b)}>
      <div className="horo-in">
        <div className="horo-face horo-front">
          <div className="horo-dust" aria-hidden="true">{dust}</div>
          <div className="horo-glyph">{sign.glyph}{'︎'}</div>
          <div className="horo-name">{sign.name[lang]}</div>
          <div className="horo-msg">{msg}</div>
          <div className="horo-tap">✦ {w.tapDay}</div>
        </div>
        <div className="horo-face horo-back">
          <h4>{w.today}</h4>
          {AREAS.map(([ic, color, k]) => {
            const a = obj(obj(H.areas)[k])
            return a.stars ? (
              <div key={k} className="horo-row">
                <div className="o" style={{ '--c': color, '--p': a.stars * 20 } as React.CSSProperties}>{ic}</div>
                <div><b>{w[k]}</b><span>{obj(a.text)[lang]}</span></div>
              </div>
            ) : null
          })}
          {H.lucky && (
            <div className="horo-charms">
              <span>✦ {H.lucky.number}</span>
              <span><i style={{ background: H.lucky.color.hex, color: H.lucky.color.hex }} />{obj(H.lucky.color.name)[lang]}</span>
            </div>
          )}
          <div className="horo-disc">{obj(H.disclaimer)[lang]}</div>
        </div>
      </div>
    </div>
  )
}

// kind (data-kind of the mockup) → component, and whether the design has a footer / extra class
export const VIEWS: Record<string, { View: (p: ViewProps) => ReactNode; foot?: boolean; cls?: string }> = {
  rss: { View: RssView }, fx: { View: FxView }, price: { View: PriceView },
  gh: { View: TermView, cls: 'term-card' }, 'gh-issues': { View: IssuesView, foot: true }, 'gh-stats': { View: StatsView }, 'gh-daily': { View: DailyView },
  world: { View: WorldView }, weather: { View: WeekView }, 'wx-now': { View: NowView, foot: true }, 'wx-hours': { View: HoursView, foot: true },
  cal: { View: CalView }, 'epi-plan': { View: PlanView }, 'epi-prof': { View: ProfView }, 'api-value': { View: ValueView }, 'api-list': { View: ListView },
  horo: { View: HoroView }, 'steam-prof': { View: SteamProfView }, 'steam-recent': { View: SteamRecentView }, 'steam-lib': { View: SteamLibView }, quote: { View: QuoteView }, fact: { View: FactView },
  'yt-channel': { View: ChannelView, foot: true }, 'yt-latest': { View: LatestView, foot: true }, 'yt-trend': { View: TrendView, foot: true }, 'yt-video': { View: VideoView, foot: true },
}
