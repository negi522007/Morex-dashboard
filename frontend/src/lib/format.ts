import { useEffect, useState } from 'react'
import { LOCALE, type Lang } from './i18n'

// Re-render every `ms` so clocks, countdowns and "x min ago" stay live
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export const compact = (n: unknown, lang: Lang) =>
  n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString(LOCALE[lang], { notation: 'compact', maximumFractionDigits: 1 })

// "3 hours ago", "il y a 2 jours"… in the user's language
export function ago(iso: string | null | undefined, lang: Lang) {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  const f = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' })
  if (s < 60) return f.format(-Math.max(0, Math.round(s)), 'second')
  if (s < 3600) return f.format(-Math.round(s / 60), 'minute')
  if (s < 172800) return f.format(-Math.round(s / 3600), 'hour')
  return f.format(-Math.round(s / 86400), 'day')
}

// Prices of any size: 73 606 / 1,08 / 0,00003412
export function num(v: number, lang: Lang) {
  const a = Math.abs(v)
  const digits = a >= 100 ? 0 : a >= 1 ? 2 : 6
  return v.toLocaleString(LOCALE[lang], { maximumFractionDigits: digits, maximumSignificantDigits: a < 1 ? 4 : undefined })
}

export const CURRENCY: Record<string, string> = { usd: '$', eur: '€', gbp: '£', jpy: '¥', chf: 'CHF', xof: 'FCFA', cad: 'CA$' }

export const initials = (name: string) =>
  name.split(/[\s.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

export const hostOf = (url: unknown) => {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
