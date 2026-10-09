import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../../lib/i18n'
import { CATALOG, SERVICES } from '../../lib/catalog'
import { useWidth, type AdminTexts, type ServiceStat } from './shared'

const meta = (service: string, lang: Lang) => {
  const m = SERVICES[service]
  // GitHub's black would vanish on the dark background
  return { label: m?.label[lang] ?? service, icon: m?.icon ?? '◌', color: m?.color === '#111827' ? '#a78bfa' : m?.color ?? '#94a3b8' }
}

// "Services" (GET /admin/service-stats): four key numbers, the services as planets around Morex
// (sized by their widgets, a red ring when some fail) with the clicked one's sheet beside it, then a
// read-only ranking of the services by number of widgets.
export function AdminServices({ services, t, lang }: { services: ServiceStat[]; t: AdminTexts; lang: Lang }) {
  const [selKey, setSelKey] = useState<string | null>(null)
  if (!services.length) return <div className="adm-glass adm-card adm-empty">{t.noWidgets}</div>

  const total = services.reduce((n, s) => n + s.widgets, 0)
  const bad = services.filter((s) => s.errors > 0).length
  const max = Math.max(...services.map((s) => s.widgets), 1)
  const sel = services.find((s) => s.service === selKey) ?? services[0]

  return (
    <>
      <div className="adm-svc-sum">
        <div style={{ '--k': '#a78bfa' } as React.CSSProperties}><b>{services.length}</b><span>{t.sumServices}</span></div>
        <div style={{ '--k': '#38bdf8' } as React.CSSProperties}><b>{total}</b><span>{t.sumWidgets}</span></div>
        <div style={{ '--k': '#34d399' } as React.CSSProperties}><b>{services.length - bad}</b><span>{t.sumHealthy}</span></div>
        <div style={{ '--k': '#f87171' } as React.CSSProperties}><b>{bad}</b><span>{t.sumBad}</span></div>
      </div>

      <div className="adm-svc-md">
        <SolarSystem services={services} selected={sel.service} onPick={setSelKey} t={t} lang={lang} />
        <ServiceSheet key={sel.service} s={sel} total={total} t={t} lang={lang} />
      </div>

      <div className="adm-glass adm-card">
        <h3>{t.ranking}</h3>
        {services.map((s, i) => {
          const m = meta(s.service, lang)
          return (
            <div key={s.service} className="adm-rank" style={{ '--c': m.color } as React.CSSProperties}>
              <span className="adm-rank-n">{i + 1}</span>
              <span className="adm-svc-ic" style={{ width: 38, height: 38 }}>{m.icon}</span>
              <span className="adm-rank-name"><b>{m.label}</b><small>{t.usersOf(s.users)}</small></span>
              <span className="adm-track"><i style={{ width: `${(s.widgets / max) * 100}%` }} /></span>
              <b className="adm-num">{s.widgets}</b>
              <span className={`adm-rank-dot ${s.errors ? 'bad' : ''}`} title={s.errors ? t.failing(s.errors, s.widgets) : t.healthy} />
            </div>
          )
        })}
      </div>
    </>
  )
}

function ServiceSheet({ s, total, t, lang }: { s: ServiceStat; total: number; t: AdminTexts; lang: Lang }) {
  const m = meta(s.service, lang)
  const types = s.types ?? []
  const top = Math.max(...types.map((x) => x.count), 1)
  return (
    <div className="adm-glass adm-sheet adm-svc-sheet" style={{ '--c': m.color } as React.CSSProperties}>
      <div className="adm-sheet-orb" aria-hidden="true" />
      <div className="adm-sheet-id">
        <span className="adm-svc-ic" style={{ width: 92, height: 92, fontSize: 42 }}>{m.icon}</span>
        <div className="adm-grow"><h3>{m.label}</h3><p>{t.svcLine(s.widgets, s.users, Math.round((s.widgets / (total || 1)) * 100))}</p></div>
      </div>
      <div className="adm-kv">
        <div style={{ '--k': m.color } as React.CSSProperties}><b>{s.widgets}</b><span>{t.cWidgets}</span></div>
        <div style={{ '--k': '#38bdf8' } as React.CSSProperties}><b>{s.users}</b><span>{t.svcUsers}</span></div>
        <div style={{ '--k': '#34d399' } as React.CSSProperties}><b>{s.widgets - s.errors}</b><span>{t.svcOk}</span></div>
        <div style={{ '--k': '#f87171' } as React.CSSProperties}><b>{s.errors}</b><span>{t.svcKo}</span></div>
      </div>
      {types.length > 0 && (
        <>
          <div className="adm-sessions-title">{t.mostUsed}</div>
          {types.map((x) => {
            const name = CATALOG.find((e) => e.service === s.service && e.widget === x.widget)?.name[lang] ?? x.widget
            return <div key={x.widget} className="adm-type"><span>{name}</span><span className="adm-track"><i style={{ width: `${(x.count / top) * 100}%` }} /></span><b className="adm-num">{x.count}</b></div>
          })}
        </>
      )}
      {s.errors ? (
        <div className="adm-svc-err"><b>⚠ {t.svcErrTitle(s.errors)}</b>{s.lastError && <code>{t.lastErrorLabel} : {s.lastError}</code>}</div>
      ) : <div className="adm-svc-ok">● {t.svcAllGood}</div>}
    </div>
  )
}

const H = 600

// Each service on its own orbit around Morex, the most used closest to the sun, all turning slowly.
// Hovering a planet freezes the system so it can be clicked; reduced-motion users get it still.
function SolarSystem({ services, selected, onPick, t, lang }: {
  services: ServiceStat[]; selected: string; onPick: (k: string) => void; t: AdminTexts; lang: Lang
}) {
  const [box, W] = useWidth<HTMLDivElement>()
  const planets = useRef<(HTMLDivElement | null)[]>([])
  const paused = useRef(false)
  // Elapsed time survives the effect restarting (data refreshed every 30 s, window resized)
  const clock = useRef(0)

  const max = Math.max(...services.map((s) => s.widgets), 1)
  // Services arrive most used first. Two per orbit, on opposite sides, so planets don't pile up:
  // services 0 and 1 share the closest orbit, 2 and 3 the next, and so on.
  const n = services.length, rings = Math.ceil(n / 2), cx = W / 2, cy = H / 2
  const maxRx = Math.max(170, W / 2 - 60), minRx = 125, maxRy = H / 2 - 55
  const ringOf = (r: number) => {
    const rx = rings > 1 ? minRx + (r / (rings - 1)) * (maxRx - minRx) : minRx
    return { rx, ry: Math.min(maxRy, rx * 0.6), speed: 0.00007 * (1.5 - (r / Math.max(1, rings - 1)) * 0.9) }
  }
  const orbit = (i: number) => { const r = Math.floor(i / 2), o = ringOf(r); return { ...o, phase: r * 1.3 + (i % 2) * Math.PI } }

  // The planets are moved straight on the DOM with a GPU transform, every frame, without re-rendering
  // React: smooth motion and no layout work. Time keeps counting while paused so nothing jumps.
  useEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0, last = performance.now()
    const place = () => {
      services.forEach((_, i) => {
        const el = planets.current[i]
        if (!el) return
        const o = orbit(i), a = o.phase + clock.current * o.speed
        el.style.transform = `translate3d(${cx + Math.cos(a) * o.rx}px, ${cy + Math.sin(a) * o.ry}px, 0)`
        el.style.zIndex = String(Math.round(Math.sin(a) * 10) + 20)
      })
    }
    const tick = (now: number) => {
      if (!paused.current) clock.current += now - last
      last = now
      place()
      raf = requestAnimationFrame(tick)
    }
    place()
    if (!still) raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [W, services]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={box} className="adm-glass adm-system">
      <svg className="adm-orbits" width={W} height={H} aria-hidden="true">
        {Array.from({ length: rings }, (_, r) => { const o = ringOf(r); return <ellipse key={r} cx={cx} cy={cy} rx={o.rx} ry={o.ry} /> })}
      </svg>
      <div className="adm-sun">MOREX</div>
      {services.map((s, i) => {
        const m = meta(s.service, lang), size = 34 + Math.sqrt(s.widgets / max) * 44
        return (
          <div key={s.service} className="adm-pl-pos" ref={(el) => { planets.current[i] = el }}>
            <button className={`adm-planet ${s.errors ? 'bad' : ''} ${s.service === selected ? 'on' : ''}`}
              onClick={() => onPick(s.service)} onMouseEnter={() => { paused.current = true }} onMouseLeave={() => { paused.current = false }}
              style={{ '--c': m.color, width: size, height: size } as React.CSSProperties}
              title={`${m.label} : ${s.widgets} widgets · ${t.usersOf(s.users)}`}>
              {m.icon}<b>{m.label}</b>
            </button>
          </div>
        )
      })}
    </div>
  )
}
