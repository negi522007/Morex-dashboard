import { useWidth, type AdminTexts } from './shared'

export interface VoyageStep { label: string; sub: string; value: number }

const H = 270
const COLORS: [string, string][] = [['#a78bfa', '#6366f1'], ['#38bdf8', '#0284c7'], ['#34d399', '#059669'], ['#f472b6', '#db2777']]
const XS = [0.09, 0.37, 0.63, 0.91], YS = [130, 72, 130, 72]

// Background stars at fixed pseudo-random spots (same on every render)
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r1 = Math.sin(i * 12.9898 + 1) * 43758.5453, r2 = Math.sin(i * 78.233 + 1) * 12345.678
  return { x: r1 - Math.floor(r1), y: (r2 - Math.floor(r2)) * H, r: (i % 3) * 0.5 + 0.6, delay: -(i % 7) * 0.4 }
})

// "Le voyage des nouveaux": the four steps of a new account (signed up → email confirmed → first widget →
// linked account) as ringed planets on a trail the Morex logo keeps travelling along. Between two steps,
// the accounts that stopped there fall off as drifting asteroids under a "−N en route" tag.
export function Voyage({ steps, t }: { steps: VoyageStep[]; t: AdminTexts }) {
  const [box, W] = useWidth<HTMLDivElement>()
  const POS = XS.map((x, i) => [x * W, YS[i]] as [number, number]), k = W * 0.12
  const total = steps[0].value || 1
  const R = steps.map((s) => 20 + (s.value / total) * 16)
  const [a, b, c, d] = POS
  const trail = `M${a[0]},${a[1]} C${a[0] + k},${a[1]} ${b[0] - k},${b[1]} ${b[0]},${b[1]} S${c[0] - k},${c[1]} ${c[0]},${c[1]} S${d[0] - k},${d[1]} ${d[0]},${d[1]}`

  return (
    <div ref={box}>
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="adm-voyage" role="img" aria-label={steps.map((s) => `${s.label} ${s.value}`).join(', ')}>
      <defs>
        {COLORS.map(([c1, c2], i) => (
          <radialGradient key={i} id={`admVoy${i}`} cx="34%" cy="30%" r="75%">
            <stop offset="0" stopColor="#fff" /><stop offset=".22" stopColor={c1} /><stop offset=".75" stopColor={c2} /><stop offset="1" stopColor="#0f172a" />
          </radialGradient>
        ))}
        <linearGradient id="admVoyTrail" x1="0" x2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset=".35" stopColor="#38bdf8" /><stop offset=".65" stopColor="#34d399" /><stop offset="1" stopColor="#f472b6" /></linearGradient>
        <filter id="admVoyGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {STARS.map((s, i) => <circle key={i} className="adm-voy-twk" cx={s.x * W} cy={s.y} r={s.r} fill="#fff" opacity=".7" style={{ animationDelay: `${s.delay}s` }} />)}
      <path d={trail} fill="none" stroke="url(#admVoyTrail)" strokeWidth="10" opacity=".18" filter="url(#admVoyGlow)" />
      <path className="adm-voy-draw" d={trail} fill="none" stroke="url(#admVoyTrail)" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />


      {steps.map((s, i) => {
        const [x, y] = POS[i], r = R[i], c1 = COLORS[i][0], pct = Math.round((s.value / total) * 100)
        return (
          <g key={s.label} className="adm-voy-stop">
            <g className="adm-voy-bob" style={{ animationDelay: `${-i}s` }}>
              <ellipse cx={x} cy={y} rx={r * 1.7} ry={r * 0.42} fill="none" stroke={c1} strokeOpacity=".55" strokeWidth="2.5" transform={`rotate(-16 ${x} ${y})`} />
              <circle cx={x} cy={y} r={r} fill={`url(#admVoy${i})`} style={{ filter: `drop-shadow(0 0 18px ${c1})` }} />
              <path d={`M${x - r * 1.7},${y} A${r * 1.7},${r * 0.42} 0 0 0 ${x + r * 1.7},${y}`} fill="none" stroke={c1} strokeWidth="2.5" transform={`rotate(-16 ${x} ${y})`} />
              <text x={x} y={y + r * 0.25} textAnchor="middle" fontSize={r * 0.7} fontWeight="700" fill="#fff">{s.value}</text>
            </g>
            <text x={x} y={y + r + 28} textAnchor="middle" fontSize="15" fontWeight="600" fill="#fff">{s.label}</text>
            <text x={x} y={y + r + 47} textAnchor="middle" fontSize="12.5" fill="rgb(255 255 255 / .65)">{pct} % · {s.sub}</text>
          </g>
        )
      })}

      {steps.slice(1).map((s, i) => {
        const lost = steps[i].value - s.value
        if (lost <= 0) return null
        const x = (POS[i][0] + POS[i + 1][0]) / 2, y = (POS[i][1] + POS[i + 1][1]) / 2 + 6
        return (
          <g key={i}>
            <g className="adm-voy-drift" style={{ animationDelay: `${-i * 1.3}s` }}><path d={`M${x - 7},${y - 3} l5,-6 l8,1 l3,7 l-6,6 l-8,-1Z`} fill="#94a3b8" opacity=".9" /></g>
            <rect x={x - 50} y={y - 40} width="100" height="24" rx="12" fill="rgb(127 29 29 / .6)" stroke="rgb(248 113 113 / .5)" />
            <text x={x} y={y - 23.5} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#fecaca">{t.lostOnWay(lost)}</text>
          </g>
        )
      })}
      {/* The Morex logo travels the trail, upright, with a soft glow */}
      <g className="adm-voy-rocket" style={{ offsetPath: `path('${trail}')` }}>
        <circle r="30" fill="#818cf8" opacity=".25" filter="url(#admVoyGlow)" />
        <image href="/logo.svg" x="-30" y="-23" width="60" height="46" />
      </g>
    </svg>
    </div>
  )
}
