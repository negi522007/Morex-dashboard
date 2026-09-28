import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { W, translateError, type Lang } from '../../lib/i18n'
import { CATALOG, REFRESH_RATES, SERVICES, prepareConfig, type CatalogEntry } from '../../lib/catalog'
import { SAMPLES } from '../../lib/samples'
import type { AboutResponse, User, WidgetParam } from '../../lib/types'
import { WidgetCard } from './WidgetGrid'
import { CityPicker, fromStored, type Picked, type Place } from './CityPicker'
import { api } from '../../lib/api'
import { ParamFields } from './ParamFields'

// Grid size of each card design on the dashboard (columns × rows, same as morex.css), so a preview can be
// drawn at its real size and then scaled down as a whole: nothing gets squashed, whatever the frame.
const SPAN: Record<string, [number, number]> = {
  world: [2, 2], weather: [2, 3], rss: [2, 4], gh: [2, 2], 'gh-daily': [2, 3], 'yt-latest': [2, 2], 'yt-trend': [2, 2], 'wx-hours': [2, 2],
  'wx-now': [1, 3], 'yt-channel': [1, 3], 'yt-video': [1, 3], 'gh-issues': [1, 3], 'gh-stats': [1, 3], cal: [1, 3], 'epi-plan': [1, 3], 'epi-prof': [1, 3],
  'api-list': [1, 3], horo: [1, 3], 'steam-prof': [1, 3], 'steam-recent': [1, 3], 'steam-lib': [1, 3],
}
const COL_W = 290, ROW_H = 128, GAP = 24
function FitCard({ kind, children }: { kind: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null), [scale, setScale] = useState(0.5)
  const [c, r] = SPAN[kind] ?? [1, 2]
  const w = c * COL_W + (c - 1) * GAP, h = r * ROW_H + (r - 1) * GAP
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(Math.min(el.clientWidth / w, el.clientHeight / h))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [w, h])
  return (
    <div ref={box} className="fit" aria-hidden="true">
      <div className="fit-in" style={{ width: w, height: h, transform: `translate(-50%, -50%) scale(${scale})` }}>{children}</div>
    </div>
  )
}

// Card filled with the snapshot data, for the drawer previews
function SampleCard({ entry, lang, config = {}, data }: { entry: CatalogEntry; lang: Lang; config?: Record<string, string | number>; data?: unknown }) {
  const s = SAMPLES[entry.kind] ?? { data: null, config: {} }
  const typed = Object.fromEntries(Object.entries(config).filter(([, v]) => String(v).trim() !== ''))
  return (
    <WidgetCard preview lang={lang} widget={{
      serviceName: entry.service, widgetName: entry.widget, config: { ...s.config, ...typed }, cachedData: data ?? s.data, insight: s.insight ?? null,
      title: null, decoration: null, refreshRateSeconds: 300, lastRefreshedAt: new Date().toISOString(),
    }} />
  )
}

export function Drawer({ open, lang, about, user, preset, service, onClose, onCreate }: {
  open: boolean
  lang: Lang
  about: AboutResponse | null
  user: User
  preset: CatalogEntry | null
  // Opens on the list of one service's widgets (e.g. 'github' after connecting GitHub)
  service?: string | null
  onClose: () => void
  // Resolves when the widget is created; rejects with the backend's message otherwise
  onCreate: (entry: CatalogEntry, config: Record<string, string | number>, refreshRateSeconds: number) => Promise<void>
}) {
  const w = W[lang]
  const [filter, setFilter] = useState('all'), [q, setQ] = useState('')
  const [picked, setPicked] = useState<CatalogEntry | null>(null)
  const [cfg, setCfg] = useState<Record<string, string>>({}), [rate, setRate] = useState(60)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [dragY, setDragY] = useState<number | null>(null)
  const grab = useRef<{ y0: number } | null>(null), search = useRef<HTMLInputElement>(null)

  // Params exactly as the backend declares them in /about.json
  const paramsOf = (e: CatalogEntry): WidgetParam[] =>
    about?.server.services.find((s) => s.name === e.service)?.widgets.find((x) => x.name === e.widget)?.params ?? []
  const available = CATALOG.filter((e) => about?.server.services.some((s) => s.name === e.service && s.widgets.some((x) => x.name === e.widget)))

  // World clock: the places picked in the form (and the timeline preview drawn from them)
  const [home, setHome] = useState<Picked | null>(null), [cities, setCities] = useState<Picked[]>([])
  const setWorld = (h: Picked | null, c: Picked[]) => {
    setHome(h); setCities(c)
    setCfg((cur) => ({ ...cur, homeTimezone: h?.stored ?? '', cities: c.map((x) => x.stored).join(', ') }))
  }
  const worldPreview = home ? { home: { timezone: home.zone || home.stored, label: home.label, iso2: home.iso2 },
    cities: cities.filter((c) => c.zone).map((c) => ({ timezone: c.zone, label: c.label, iso2: c.iso2 })) } : undefined

  const pick = (e: CatalogEntry) => {
    setPicked(e); setRate(60); setError('')
    // The backend already knows the user's sign from their birth date: the horoscope starts with it
    setCfg(e.widget === 'horoscope' && user.zodiac ? { sign: user.zodiac } : {})
    if (e.widget === 'world_clock') {
      // Your city starts as the time zone of this device
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setWorld({ ...fromStored(tz), zone: tz }, [])
      // …shown with its name and flag, looked up in the same place list
      api.get<Place[]>(`/services/worldclock/places?${new URLSearchParams({ q: tz.split('/').pop()!.replace(/_/g, ' '), lang, limit: '5' })}`)
        .then((r) => { const p = r.find((x) => x.value === tz && x.kind !== 'zone'); if (p) setWorld({ stored: tz, zone: tz, label: p.label.split(',')[0], iso2: p.iso2 }, []) })
        .catch(() => {})
    }
  }
  useEffect(() => {
    if (!open) return
    setQ(''); setError('')
    setFilter(service ?? 'all')
    if (preset) pick(preset); else setPicked(null)
    const id = setTimeout(() => search.current?.focus({ preventScroll: true }), 300)
    return () => clearTimeout(id)
  }, [open, preset, service])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (picked) setPicked(null); else onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, picked, onClose])

  const needle = q.trim().toLowerCase()
  const items = available.filter((e) => (filter === 'all' || e.service === filter) && (!needle || `${e.name[lang]} ${SERVICES[e.service].label[lang]}`.toLowerCase().includes(needle)))
  const groups = [...new Set(items.map((e) => e.service))]
  const params = picked ? paramsOf(picked) : []
  const valid = params.every((p) => !p.required || String(cfg[p.name] ?? '').trim())
  const blocked = picked?.needs === 'github' ? !user.githubLinked : picked?.needs === 'epitech' ? !user.epitech : false
  // Can this server connect that account at all? (GET /auth/<provider>/status)
  const [canLink, setCanLink] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (!picked?.needs || canLink[picked.needs] !== undefined) return
    const id = picked.needs
    api.get<{ configured: boolean }>(`/auth/${id}/status`).then((r) => setCanLink((c) => ({ ...c, [id]: r.configured }))).catch(() => setCanLink((c) => ({ ...c, [id]: false })))
  }, [picked, canLink])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!picked || !valid || busy) return
    const config: Record<string, string | number> = {}
    for (const p of params) {
      const v = String(cfg[p.name] ?? '').trim()
      if (v) config[p.name] = p.type === 'integer' ? Number(v) : v
    }
    setBusy(true); setError('')
    try {
      await onCreate(picked, prepareConfig(picked.service, picked.widget, config, lang), rate)
    } catch (err) {
      setError(translateError((err as Error).message, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="dw-scrim" onClick={onClose} />
      <section className={`dw${picked ? ' configuring' : ''}`} role="dialog" aria-modal="true" aria-label={w.dwTitle}
        style={dragY ? { transition: 'none', translate: `0 ${dragY}px` } : undefined}>
        <div className="dw-grab" aria-hidden="true"
          onPointerDown={(e) => { grab.current = { y0: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={(e) => grab.current && setDragY(Math.max(0, e.clientY - grab.current.y0))}
          onPointerUp={(e) => { const dy = grab.current ? e.clientY - grab.current.y0 : 0; grab.current = null; setDragY(null); if (dy > 120) onClose() }}><i /></div>
        <div className="dw-top">
          <button className="dw-round dw-back" aria-label={w.back} onClick={() => setPicked(null)}>‹</button>
          <h2>{picked ? picked.name[lang] : w.dwTitle}</h2>
          <button className="dw-round" aria-label={w.close} onClick={onClose}>✕</button>
        </div>
        <div className="dw-stage">
          <div className="dw-page">
            <input ref={search} className="dw-search" type="search" placeholder={w.dwSearch} aria-label={w.dwSearch} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="dw-filters" role="group">
              {[['all', w.all], ...Object.entries(SERVICES).filter(([k]) => available.some((e) => e.service === k)).map(([k, v]) => [k, `${v.icon} ${v.label[lang]}`])].map(([k, l]) => (
                <button key={k} className={k === filter ? 'on' : ''} aria-pressed={k === filter} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
            <div className="dw-previews">
              {!groups.length && <p className="muted" style={{ gridColumn: '1/-1', textAlign: 'center' }}>{w.noneFound}</p>}
              {open && groups.map((g) => [
                <div key={`g-${g}`} className="dw-group">{SERVICES[g].icon} {SERVICES[g].label[lang]}</div>,
                ...items.filter((e) => e.service === g).map((e) => (
                  <button key={e.kind} className="dw-pv" aria-label={e.name[lang]} onClick={() => pick(e)}>
                    <FitCard kind={e.kind}><SampleCard entry={e} lang={lang} /></FitCard>
                    <span className="dw-name">{e.name[lang]}</span>
                    <span className="dw-badge" style={{ background: SERVICES[g].color }} aria-hidden="true">{SERVICES[g].icon}</span>
                  </button>
                )),
              ])}
            </div>
          </div>
          <div className="dw-page">
            {picked && (
              <div className="dw-cfg">
                <div className="dw-live"><div className="frame"><FitCard kind={picked.kind}><SampleCard entry={picked} lang={lang} config={cfg} data={picked.widget === 'world_clock' && cities.length ? worldPreview : undefined} /></FitCard></div><p>{w.livePreview}</p></div>
                <form onSubmit={submit}>
                  {!params.length && <p className="muted" style={{ fontSize: 13 }}>{w.noParams}</p>}
                  {picked.widget === 'world_clock' && <CityPicker lang={lang} home={home} cities={cities} onChange={setWorld} />}
                  {picked.widget !== 'world_clock' && <ParamFields entry={picked} params={params} cfg={cfg} setCfg={setCfg} lang={lang} user={user} />}
                  {picked.widget === 'horoscope' && user.zodiac && cfg.sign === user.zodiac && <small className="pf-ok">🎂 {w.fromBirth}</small>}
                  <div className="dw-field">{w.refresh}
                    <div className="dw-rates" role="radiogroup">
                      {REFRESH_RATES.map(([sec, l]) => <button key={sec} type="button" role="radio" aria-checked={sec === rate} className={sec === rate ? 'on' : ''} onClick={() => setRate(sec)}>{l}</button>)}
                    </div>
                  </div>
                  {blocked ? (
                    <>
                      <p className="muted" style={{ fontSize: 13 }}>{picked.needs === 'github' ? w.needsGithub : w.needsEpitech}</p>
                      {canLink[picked.needs!] === false ? (
                        <p className="muted" style={{ fontSize: 13 }}>{w.notReady}</p>
                      ) : (
                        <a className="dw-add" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} href={picked.needs === 'github' ? '/auth/github' : '/auth/epitech'}>
                          {picked.needs === 'github' ? w.connectGithub : w.connectEpitech}
                        </a>
                      )}
                    </>
                  ) : (
                    <button className="dw-add" type="submit" disabled={!valid || busy}>{w.addToDash}</button>
                  )}
                  {error && <p style={{ color: '#fca5a5', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
                </form>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
