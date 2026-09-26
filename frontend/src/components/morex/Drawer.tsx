import { useEffect, useRef, useState } from 'react'
import { W, type Lang } from '../../lib/i18n'
import { CATALOG, REFRESH_RATES, SERVICES, prepareConfig, type CatalogEntry } from '../../lib/catalog'
import { SAMPLES } from '../../lib/samples'
import type { AboutResponse, User, WidgetParam } from '../../lib/types'
import { WidgetCard } from './WidgetGrid'

// Card filled with the snapshot data, for the drawer previews
function SampleCard({ entry, lang, config = {} }: { entry: CatalogEntry; lang: Lang; config?: Record<string, string | number> }) {
  const s = SAMPLES[entry.kind] ?? { data: null, config: {} }
  const typed = Object.fromEntries(Object.entries(config).filter(([, v]) => String(v).trim() !== ''))
  return (
    <WidgetCard preview lang={lang} widget={{
      serviceName: entry.service, widgetName: entry.widget, config: { ...s.config, ...typed }, cachedData: s.data, insight: s.insight ?? null,
      title: null, decoration: null, refreshRateSeconds: 300, lastRefreshedAt: new Date().toISOString(),
    }} />
  )
}

export function Drawer({ open, lang, about, user, preset, onClose, onCreate }: {
  open: boolean
  lang: Lang
  about: AboutResponse | null
  user: User
  preset: CatalogEntry | null
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

  const pick = (e: CatalogEntry) => {
    setPicked(e); setRate(60); setError('')
    setCfg({})
  }
  useEffect(() => {
    if (!open) return
    setQ(''); setError('')
    if (preset) pick(preset); else setPicked(null)
    const id = setTimeout(() => search.current?.focus({ preventScroll: true }), 300)
    return () => clearTimeout(id)
  }, [open, preset])
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
      setError((err as Error).message)
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
                  <button key={e.kind} className={`dw-pv${e.wide ? ' wide' : ''}`} aria-label={e.name[lang]} onClick={() => pick(e)}>
                    <div className="shrink" aria-hidden="true"><SampleCard entry={e} lang={lang} /></div>
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
                <div className="dw-live"><div className="frame"><SampleCard entry={picked} lang={lang} config={cfg} /></div><p>{w.livePreview}</p></div>
                <form onSubmit={submit}>
                  {!params.length && <p className="muted" style={{ fontSize: 13 }}>{w.noParams}</p>}
                  {params.map((p) => {
                    const [hint, ex] = picked.hints[p.name] ?? [{ fr: '', en: '', es: '' }, '']
                    return (
                      <label key={p.name} className="dw-field">{p.name}{p.required ? ' *' : ''}{p.secret ? ' 🔒' : ''}
                        <input name={p.name} type={p.type === 'integer' ? 'number' : p.secret ? 'password' : 'text'} value={cfg[p.name] ?? ''} placeholder={ex}
                          required={p.required} autoComplete="off" onChange={(e) => setCfg((c) => ({ ...c, [p.name]: e.target.value }))} />
                        <small>{hint[lang]}{ex ? `, ${w.eg} ${ex}` : ''}</small>
                      </label>
                    )
                  })}
                  <div className="dw-field">{w.refresh}
                    <div className="dw-rates" role="radiogroup">
                      {REFRESH_RATES.map(([sec, l]) => <button key={sec} type="button" role="radio" aria-checked={sec === rate} className={sec === rate ? 'on' : ''} onClick={() => setRate(sec)}>{l}</button>)}
                    </div>
                  </div>
                  {blocked ? (
                    <>
                      <p className="muted" style={{ fontSize: 13 }}>{picked.needs === 'github' ? w.needsGithub : w.needsEpitech}</p>
                      <a className="dw-add" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} href={picked.needs === 'github' ? '/auth/github' : '/auth/epitech'}>
                        {picked.needs === 'github' ? w.connectGithub : w.connectEpitech}
                      </a>
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
