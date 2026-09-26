import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'

// Shared classes for text inputs sitting on the frosted-glass panel.
export const glassInputClass =
  'glass-input w-full rounded-full border border-white/20 bg-white/10 px-5 py-3.5 text-base text-white placeholder-white/50 shadow-inner backdrop-blur-sm transition focus:border-white/50 focus:bg-white/15 focus:ring-2 focus:ring-indigo-300/30 focus:outline-none'

export const glassLabelClass = 'mb-2 ml-2 block text-sm font-medium tracking-wide text-white/80'

type AuthLayoutProps = {
  title: string
  subtitle?: string
  // The pill on the left side that switches between login and register.
  switchPrompt: string
  switchLabel: string
  switchTo: string
  children: ReactNode
}

export function AuthLayout({ title, subtitle, switchPrompt, switchLabel, switchTo, children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 font-sans text-white">
      {/* Background: slow drift gives the scene some life */}
      <div
        aria-hidden
        className="absolute inset-0 animate-drift bg-cover bg-center"
        style={{ backgroundImage: 'url(/accueil_photo.jpg)' }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-indigo-950/40 to-slate-950/60"
      />

      <div className="relative grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-indigo-950/60 md:min-h-[680px] md:grid-cols-[1.1fr_1fr]">
        {/* Brand side */}
        <section className="flex min-w-0 flex-col justify-between gap-10 bg-slate-950/20 p-8 md:p-14">
          <div className="flex animate-fade-up items-center gap-2.5">
            <Logo size={52} />
            <span className="text-2xl font-semibold tracking-tight">Morex</span>
          </div>

          <div className="animate-fade-up [animation-delay:120ms]">
            <h1 className="text-6xl font-bold tracking-tight md:text-8xl">
              <span className="bg-gradient-to-r from-white via-indigo-100 to-sky-300 bg-clip-text text-transparent">
                Morex
              </span>
            </h1>
            <p className="mt-4 text-2xl font-light text-white/85 md:text-3xl">Your universe, at a glance</p>
          </div>

          <Link
            to={switchTo}
            className="group flex w-fit animate-fade-up flex-col rounded-2xl border border-white/20 bg-white/10 px-6 py-4 backdrop-blur-md transition hover:bg-white/20 [animation-delay:240ms]"
          >
            <span className="text-sm text-white/70">{switchPrompt}</span>
            <span className="flex items-center gap-2 text-lg font-medium">
              {switchLabel}
              <span aria-hidden className="transition group-hover:translate-x-1">
                »
              </span>
            </span>
          </Link>
        </section>

        {/* Form side */}
        <section className="flex min-w-0 animate-fade-up flex-col justify-center border-t border-white/10 bg-white/10 p-8 backdrop-blur-2xl [animation-delay:180ms] md:border-t-0 md:border-l md:p-14">
          <h2 className="text-4xl font-semibold">{title}</h2>
          {subtitle && <p className="mt-2 text-base text-white/70">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </section>
      </div>
    </div>
  )
}
