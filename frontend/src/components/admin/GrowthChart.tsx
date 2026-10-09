import { useState } from 'react'
import type { Lang } from '../../lib/i18n'
import { useWidth, type AdminTexts } from './shared'

const H = 290, PAD = { l: 44, r: 24, t: 24, b: 34 }

// Smooth line through the points that never overshoots between two equal values (control points are
// clamped to each segment's own height), so a flat week stays flat
function smooth(p: [number, number][]) {
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]), cl = (y: number) => Math.min(hi, Math.max(lo, y))
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${cl(p1[1] + (p2[1] - p0[1]) / 6)} ${p2[0] - (p3[0] - p1[0]) / 6},${cl(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]},${p2[1]}`
  }
  return d
}

// "Croissance": accounts at the end of each of the last 14 days. Big total on top, labelled grid,
// a glowing dot on today, and a hover guide; the hovered day's total and new sign-ups show at the top right.
export function GrowthChart({ points, t, lang }: { points: { day: Date; count: number }[]; t: AdminTexts; lang: Lang }) {
  const [box, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const first = points[0].count, last = points[points.length - 1].count
  const top = Math.max(last, 1), step = Math.max(1, Math.ceil(top / 3))
  const yMax = step * 3, ticks = [0, step, step * 2, yMax]
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b)
  const xy = points.map((p, i) => [x(i), y(p.count)] as [number, number])
  const line = smooth(xy)
  const fmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
  const h = hover ?? points.length - 1, hp = points[h], added = h ? hp.count - points[h - 1].count : 0
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1)))))
  }

  return (
    <div className="adm-growth">
      <div className="adm-growth-head">
        <span className="adm-growth-big">{last}</span>
        <span className={`adm-growth-delta ${last - first > 0 ? 'up' : ''}`}>{t.growthDelta(last - first)}</span>
        <span className="adm-growth-tip"><b>{h === points.length - 1 ? t.today : fmt.format(hp.day)}</b> · {t.growthTip(hp.count, added)}</span>
      </div>
      <div ref={box}><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="adm-growth-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="admGrowFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#818cf8" stopOpacity=".45" /><stop offset="1" stopColor="#818cf8" stopOpacity="0" /></linearGradient>
          <linearGradient id="admGrowLine"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#38bdf8" /></linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgb(255 255 255 / .08)" strokeDasharray={v ? '4 6' : undefined} />
            <text x={PAD.l - 12} y={y(v) + 4} textAnchor="end" fontSize="12" fill="rgb(255 255 255 / .5)">{v}</text>
          </g>
        ))}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="12" fill="rgb(255 255 255 / .5)">
            {i === points.length - 1 ? t.today : fmt.format(points[i].day)}
          </text>
        ))}
        <path d={`${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#admGrowFill)" />
        <path d={line} fill="none" stroke="url(#admGrowLine)" strokeWidth="3.5" strokeLinecap="round" />
        <line x1={xy[h][0]} x2={xy[h][0]} y1={PAD.t - 6} y2={y(0)} stroke="rgb(255 255 255 / .25)" strokeDasharray="3 5" />
        <circle cx={xy[h][0]} cy={xy[h][1]} r="12" fill="#38bdf8" opacity=".25" className="adm-growth-halo" />
        <circle cx={xy[h][0]} cy={xy[h][1]} r="6" fill="#fff" stroke="#38bdf8" strokeWidth="3" />
      </svg></div>
    </div>
  )
}
