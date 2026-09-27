import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { W, type Lang } from '../../lib/i18n'
import { flagOf } from '../../lib/format'

// World clock form: "your city" + the cities to show, picked from GET /services/worldclock/places
// (cities, countries and time zones, with their UTC offset and country code for the flag).

export interface Place { value: string; label: string; kind: 'city' | 'country' | 'zone'; country: string | null; iso2: string | null; offset: string }
// What the widget stores for one place (a name the backend resolves, or the IANA zone) and how it is shown
export interface Picked { stored: string; zone: string; label: string; iso2: string | null }

const KIND_ICON = { city: '🏙️', country: '🌍', zone: '🕐' }
const pretty = (zone: string) => (zone.split('/').pop() ?? zone).replace(/_/g, ' ')
const places = (q: string, lang: Lang, limit = 7) =>
  api.get<Place[]>(`/services/worldclock/places?${new URLSearchParams({ q, lang, limit: String(limit) })}`)

// The widget keeps the name when it points to the same zone as the place picked ("Londres" → London),
// so the card shows the name in the user's language; otherwise the exact zone ("Londres, Canada" → America/Toronto).
async function toPicked(p: Place, lang: Lang): Promise<Picked> {
  const name = p.kind === 'zone' ? '' : p.label.split(',')[0].trim()
  let stored = p.value
  if (name) {
    const best = (await places(name, lang, 5).catch(() => [])).find((x) => x.kind !== 'zone' && x.label.split(',')[0].trim() === name)
    if (best && best.value === p.value) stored = name
  }
  return { stored, zone: p.value, label: name || pretty(p.value), iso2: p.iso2 }
}
// Settings saved earlier ("Paris" or "Europe/Paris") shown back as picked places
export const fromStored = (s: string): Picked => ({ stored: s, zone: s.includes('/') ? s : '', label: s.includes('/') ? pretty(s) : s, iso2: null })

function Search({ lang, placeholder, onPick, autoFocus }: { lang: Lang; placeholder: string; onPick: (p: Place) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState(''), [open, setOpen] = useState(false), [hits, setHits] = useState<Place[]>([]), [sel, setSel] = useState(0)
  const ticket = useRef(0)
  useEffect(() => {
    if (!open) return
    const my = ++ticket.current
    const id = setTimeout(() => places(q.trim(), lang).then((r) => { if (my === ticket.current) { setHits(r); setSel(0) } }).catch(() => {}), 150)
    return () => clearTimeout(id)
  }, [q, open, lang])
  const pick = (p: Place | undefined) => { if (p) { onPick(p); setQ('') } }
  const f = q.trim().toLowerCase()
  const mark = (label: string) => {
    const i = f ? label.toLowerCase().indexOf(f) : -1
    return i < 0 ? label : <>{label.slice(0, i)}<mark>{label.slice(i, i + f.length)}</mark>{label.slice(i + f.length)}</>
  }
  return (
    <div className={`cp-field${open ? ' open' : ''}`}>
      <input value={q} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off"
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { setSel((s) => Math.min(s + 1, hits.length - 1)); e.preventDefault() }
          if (e.key === 'ArrowUp') { setSel((s) => Math.max(s - 1, 0)); e.preventDefault() }
          if (e.key === 'Enter') { pick(hits[sel]); e.preventDefault() }
          if (e.key === 'Escape') setOpen(false)
        }} />
      <div className="cp-drop" role="listbox">
        {hits.length ? hits.map((p, i) => (
          <div key={`${p.value}-${p.label}`} role="option" aria-selected={i === sel} className={`cp-opt${i === sel ? ' on' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); pick(p) }}>
            <span className="cp-flag">{p.iso2 ? flagOf(p.iso2) : KIND_ICON[p.kind]}</span>
            <span className="cp-t">{mark(p.label)}<small>{p.offset}{p.kind === 'zone' ? ` · ${W[lang].zoneWord}` : p.kind === 'country' ? ` · ${W[lang].countryWord}` : ''}</small></span>
          </div>
        )) : <div className="cp-empty">{W[lang].noPlace}</div>}
      </div>
    </div>
  )
}

export function CityPicker({ lang, home, cities, onChange }: {
  lang: Lang
  home: Picked | null
  cities: Picked[]
  onChange: (home: Picked | null, cities: Picked[]) => void
}) {
  const w = W[lang], [changing, setChanging] = useState(!home)
  return (
    <div className="cp">
      <div className="dw-field">{w.yourCity} *
        {home && !changing ? (
          <div className="cp-home">📍 <span className="cp-flag">{home.iso2 ? flagOf(home.iso2) : ''}</span><b>{home.label}</b>
            <button type="button" onClick={() => setChanging(true)}>{w.change}</button></div>
        ) : (
          <Search lang={lang} placeholder={w.searchCity} autoFocus={!!home}
            onPick={async (p) => { onChange(await toPicked(p, lang), cities); setChanging(false) }} />
        )}
      </div>
      <div className="dw-field">{w.citiesToShow} *
        <Search lang={lang} placeholder={w.addCity} onPick={async (p) => {
          const c = await toPicked(p, lang)
          if (!cities.some((x) => x.stored === c.stored)) onChange(home, [...cities, c])
        }} />
        {cities.length > 0 && (
          <div className="cp-chips">
            {cities.map((c) => (
              <span key={c.stored} className="cp-chip">{c.iso2 ? flagOf(c.iso2) : '🌐'} {c.label}
                <button type="button" aria-label="✕" onClick={() => onChange(home, cities.filter((x) => x !== c))}>✕</button></span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
