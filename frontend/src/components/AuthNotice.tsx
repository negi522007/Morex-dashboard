import type { ReactNode } from 'react'
import { AUTH, useAuthLang } from '../lib/authLang'

// The "little planet" message of the login and sign-up pages: a floating emoji, a short friendly title and
// one sentence that says what to do next. `kind` picks the planet and the colour.
export type NoticeKind = 'wrong' | 'confirm' | 'error' | 'sent'

const LOOK: Record<NoticeKind, { emoji: string; ring: string }> = {
  wrong: { emoji: '🪐', ring: 'border-rose-300/40 bg-rose-500/10' },
  confirm: { emoji: '📬', ring: 'border-amber-300/40 bg-amber-400/10' },
  error: { emoji: '☄️', ring: 'border-rose-300/40 bg-rose-500/10' },
  sent: { emoji: '🚀', ring: 'border-emerald-300/40 bg-emerald-400/10' },
}

export function AuthNotice({ kind, detail, children }: { kind: NoticeKind; detail?: string; children?: ReactNode }) {
  const a = AUTH[useAuthLang()]
  const title = { wrong: a.nWrong, confirm: a.nConfirm, error: a.nError, sent: a.nSent }[kind]
  const text = detail ?? { wrong: a.nWrongText, confirm: a.nConfirmText, error: a.wrong, sent: a.nSentText }[kind]
  return (
    <div role={kind === 'sent' ? 'status' : 'alert'} className={`rounded-3xl border px-5 py-4 text-center ${LOOK[kind].ring}`}>
      <div aria-hidden className="animate-[planet_3s_ease-in-out_infinite] text-5xl leading-none">{LOOK[kind].emoji}</div>
      <p className="mt-2 text-base font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-white/75">{text}</p>
      {children}
    </div>
  )
}
