import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { AUTH, useAuthLang } from '../lib/authLang'

// The "or" line and the other ways to sign in, shared by the login and sign-up pages:
// GitHub, "Continue with Microsoft (school)" and "Continue with My Epitech" — each greyed out until configured.
// Each provider says through GET /auth/<provider>/status whether this server has its client id and secret;
// until it has, the button stays greyed out with a short reason instead of leading to an error.
const PROVIDERS = [
  { id: 'github', icon: <GithubIcon /> },
  { id: 'microsoft', icon: <MicrosoftIcon /> },
  { id: 'epitech', icon: <span className="grid h-5 w-5 place-items-center rounded bg-[#0b5fff] text-[9px] font-extrabold">EPI</span> },
] as const

export function SsoButtons() {
  const a = AUTH[useAuthLang()]
  const [ready, setReady] = useState<Record<string, boolean>>({})
  useEffect(() => {
    for (const p of PROVIDERS) {
      apiFetch<{ configured: boolean }>(`/auth/${p.id}/status`)
        .then((r) => setReady((s) => ({ ...s, [p.id]: r.configured })))
        .catch(() => setReady((s) => ({ ...s, [p.id]: false })))
    }
  }, [])
  const base = 'flex w-full items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 py-3.5 text-base font-medium text-white backdrop-blur-sm transition'
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/20" />
        <span className="text-xs text-white/60">{a.or}</span>
        <div className="h-px flex-1 bg-white/20" />
      </div>
      {PROVIDERS.map((p) => {
        const label = p.id === 'github' ? a.github : p.id === 'microsoft' ? a.microsoft : a.epitech
        return ready[p.id] ? (
          // A real navigation: the backend answers with a redirect to the provider's login page
          <a key={p.id} href={`/auth/${p.id}/login`} className={`${base} hover:bg-white/20`}>{p.icon}{label}</a>
        ) : (
          <div key={p.id}>
            <button type="button" disabled className={`${base} cursor-not-allowed opacity-50`}>{p.icon}{label}</button>
            {ready[p.id] === false && <p className="mt-1 text-center text-xs text-white/50">{a.notReady}</p>}
          </div>
        )
      })}
    </>
  )
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-5 w-5">
      <path d="M12 2C6.48 2 2 6.58 2 12.2c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.51-3.5-.7-3.72-1.34-.13-.34-.68-1.38-1.16-1.66-.4-.22-.97-.77-.01-.78.9-.01 1.55.85 1.76 1.2 1.03 1.75 2.68 1.26 3.33.96.1-.75.4-1.26.72-1.55-2.53-.29-5.18-1.29-5.18-5.72 0-1.26.44-2.3 1.16-3.11-.12-.29-.5-1.48.11-3.08 0 0 .95-.31 3.12 1.19a10.6 10.6 0 0 1 2.84-.39c.96 0 1.93.13 2.84.39 2.17-1.5 3.12-1.19 3.12-1.19.61 1.6.23 2.79.11 3.08.72.81 1.16 1.84 1.16 3.11 0 4.44-2.66 5.43-5.19 5.72.41.36.77 1.07.77 2.17 0 1.57-.01 2.83-.01 3.22 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.2C22 6.58 17.52 2 12 2Z" />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" aria-hidden className="h-5 w-5">
      <path fill="#f25022" d="M1 1h10v10H1z" /><path fill="#7fba00" d="M12 1h10v10H12z" /><path fill="#00a4ef" d="M1 12h10v10H1z" /><path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  )
}
