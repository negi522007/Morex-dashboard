import { Link } from 'react-router-dom'
import { useAuthLang } from '../lib/authLang'
import type { Lang } from '../lib/i18n'

// Shared shell for /terms and /privacy: plain-language, honest tone (this is a student
// project, not a company — see PRIVACY.md at the repo root, which this page summarizes).
export function LegalPage({ titleKey, backKey, children }: { titleKey: Record<Lang, string>; backKey: Record<Lang, string>; children: (lang: Lang) => React.ReactNode }) {
  const lang = useAuthLang()
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 font-sans text-white">
      <div className="mx-auto max-w-2xl">
        <Link to="/register" className="text-sm text-white/60 underline decoration-white/30 hover:text-white">
          {backKey[lang]}
        </Link>
        <h1 className="mt-4 mb-6 text-3xl font-bold">{titleKey[lang]}</h1>
        <div className="space-y-4 text-[15px] leading-relaxed text-white/85 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children(lang)}
        </div>
      </div>
    </div>
  )
}
