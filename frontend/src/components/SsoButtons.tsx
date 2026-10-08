import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { AUTH, useAuthLang } from '../lib/authLang'

// The "or" line and the other ways to sign in, shared by the login and sign-up pages:
// GitHub, "Continue with Microsoft (school)" and "Continue with My Epitech" — each greyed out until configured.
// Each provider says through GET /auth/<provider>/status whether this server has its client id and secret;
// until it has, the button stays greyed out with a short reason instead of leading to an error.
const PROVIDERS = [
  { id: 'github', icon: <GithubIcon /> },
  { id: 'google', icon: <GoogleIcon /> },
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
        const label = p.id === 'github' ? a.github : p.id === 'google' ? a.google : p.id === 'microsoft' ? a.microsoft : a.epitech
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="h-5 w-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 5 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.7 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 7 29.6 5 24 5c-7.6 0-14.1 4.3-17.7 10.6-.1.2 0 0 0 0Z" />
      <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 36 26.9 37 24 37c-5.3 0-9.7-3.6-11.3-8.4l-6.6 5.1C9.5 40.5 16.2 45 24 45Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.6 5.6c-.5.4 7.4-5.4 7.4-15.7 0-1.2-.1-2.3-.4-3.5Z" />
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
