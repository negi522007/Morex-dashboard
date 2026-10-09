import { useEffect, useState } from 'react'

export interface RingPart { label: string; value: number; color: string; onClick?: () => void }

const W = 360, H = 230, CX = 180, CY = 115, RX = 165, RY = 42, TILT = -14 * (Math.PI / 180)
const GAP = 0.05 // radians left empty between two parts of the ring

// Point of the tilted ring at angle a (the ring is an ellipse rotated by TILT around the planet)
function at(a: number): [number, number] {
  const x = RX * Math.cos(a), y = RY * Math.sin(a)
  return [CX + x * Math.cos(TILT) - y * Math.sin(TILT), CY + x * Math.sin(TILT) + y * Math.cos(TILT)]
}

// One part of the ring, cut into the runs that pass behind the planet (upper half, sin < 0) and in
// front of it (lower half), so the planet can be drawn between the two layers
function runs(a0: number, a1: number) {
  const out: { front: boolean; d: string }[] = []
  let cur: { front: boolean; pts: [number, number][] } | null = null
  for (let a = a0; a <= a1 + 1e-9; a += Math.min(0.03, a1 - a0 || 0.03)) {
    const front = Math.sin(a) > 0
    if (!cur || cur.front !== front) { if (cur) { cur.pts.push(at(a)); out.push({ front: cur.front, d: path(cur.pts) }) } cur = { front, pts: [at(a)] } }
    else cur.pts.push(at(a))
    if (a1 - a0 < 0.03) break
  }
  if (cur && cur.pts.length > 1) out.push({ front: cur.front, d: path(cur.pts) })
  return out
}
const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

// "Répartition" as a planet: the total in the middle, each status a coloured stretch of its ring,
// which turns slowly. Hovering a stretch or a legend line puts it forward and shows its count.
export function RingPlanet({ parts, total, word }: { parts: RingPart[]; total: number; word: string }) {
  const [spin, setSpin] = useState(0)
  const [hl, setHl] = useState<number | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0, last = performance.now()
    const tick = (now: number) => { setSpin((s) => (s + (now - last) * 0.00012) % (2 * Math.PI)); last = now; raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const sum = parts.reduce((n, p) => n + p.value, 0) || 1
  let start = spin
  const segs = parts.map((p, i) => {
    const len = (p.value / sum) * 2 * Math.PI, a0 = start + GAP / 2, a1 = start + len - GAP / 2
    start += len
    return p.value > 0 && a1 > a0 ? { i, color: p.color, runs: runs(a0, a1) } : null
  }).filter(Boolean) as { i: number; color: string; runs: { front: boolean; d: string }[] }[]
  const layer = (front: boolean) => segs.flatMap((s) => s.runs.filter((r) => r.front === front).map((r, k) => (
    <path key={`${s.i}-${front}-${k}`} d={r.d} fill="none" stroke={s.color} strokeWidth={hl === s.i ? 22 : 15} strokeLinecap="butt"
      opacity={hl == null || hl === s.i ? 1 : 0.3} style={{ filter: `drop-shadow(0 0 8px ${s.color}aa)`, transition: 'stroke-width .25s, opacity .25s', cursor: 'pointer' }}
      onMouseEnter={() => setHl(s.i)} onMouseLeave={() => setHl(null)} onClick={parts[s.i].onClick} />
  )))
  const shown = hl == null ? null : parts[hl]

  return (
    <div className="adm-ringplanet">
      <svg viewBox={`0 0 ${W} ${H}`} className="adm-ringplanet-svg" role="img" aria-label={`${total} ${word}`}>
        <defs>
          <radialGradient id="admPlanet" cx="34%" cy="30%" r="75%"><stop offset="0" stopColor="#fff" /><stop offset=".18" stopColor="#c4b5fd" /><stop offset=".55" stopColor="#6366f1" /><stop offset="1" stopColor="#1e1b4b" /></radialGradient>
        </defs>
        <path d={path(Array.from({ length: 121 }, (_, k) => at((k / 120) * 2 * Math.PI)))} fill="none" stroke="rgb(255 255 255 / .07)" strokeWidth="15" />
        {layer(false)}
        <circle cx={CX} cy={CY} r="70" fill="url(#admPlanet)" style={{ filter: 'drop-shadow(0 0 28px rgb(129 140 248 / .7))' }} />
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="44" fontWeight="700" fill="#fff">{shown ? shown.value : total}</text>
        <text x={CX} y={CY + 16} textAnchor="middle" fontSize="13" fontWeight="600" fill={shown ? '#fff' : 'rgb(255 255 255 / .75)'}>{shown ? shown.label.toLowerCase() : word}</text>
        {layer(true)}
      </svg>
      <ul className="adm-ring-legend">
        {parts.map((p, i) => (
          <li key={p.label} className={`${p.value ? '' : 'zero'} ${hl === i ? 'hl' : ''}`} onMouseEnter={() => setHl(i)} onMouseLeave={() => setHl(null)} onClick={p.onClick}>
            <i style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }} />{p.label}
            <b>{p.value}</b><em>{Math.round((p.value / sum) * 100)} %</em>
          </li>
        ))}
      </ul>
    </div>
  )
}
