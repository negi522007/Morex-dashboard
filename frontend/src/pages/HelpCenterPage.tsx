import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuthLang } from '../lib/authLang'
import type { Lang } from '../lib/i18n'

// The searchable Help Center page (FRONTEND.md § "Help assistant", point 3): the same
// `/helpdesk/knowledge` data the contextual "?" popovers and the help chat use, as a
// full standalone page — public (no session needed), client-side search.
interface Entry { id: string; kind: 'guide' | 'service' | 'widget' | 'term'; title: string; body: string; related: { id: string; title: string }[] }

const T = {
  fr: { title: 'Centre d’aide', search: 'Rechercher…', none: 'Aucun résultat', guides: 'Guides', services: 'Services et widgets', terms: 'Glossaire', related: 'Voir aussi', back: '← Retour' },
  en: { title: 'Help Center', search: 'Search…', none: 'No results', guides: 'Guides', services: 'Services & widgets', terms: 'Glossary', related: 'See also', back: '← Back' },
  es: { title: 'Centro de ayuda', search: 'Buscar…', none: 'Sin resultados', guides: 'Guías', services: 'Servicios y widgets', terms: 'Glosario', related: 'Ver también', back: '← Volver' },
} satisfies Record<Lang, Record<string, string>>

const GROUP: Record<Entry['kind'], keyof (typeof T)['en']> = { guide: 'guides', service: 'services', widget: 'services', term: 'terms' }

function fold(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function HelpCenterPage() {
  const lang = useAuthLang()
  const t = T[lang]
  const [entries, setEntries] = useState<Entry[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ entries: Entry[] }>(`/helpdesk/knowledge?lang=${lang}`).then((r) => setEntries(r.entries)).catch(() => setEntries([]))
  }, [lang])

  const needle = fold(q.trim())
  const filtered = useMemo(
    () => (needle ? entries.filter((e) => fold(e.title).includes(needle) || fold(e.body).includes(needle)) : entries),
    [entries, needle],
  )
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])
  const groups: Record<string, Entry[]> = { guides: [], services: [], terms: [] }
  for (const e of filtered) groups[GROUP[e.kind]].push(e)

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 font-sans text-white">
      <div className="mx-auto max-w-3xl">
        <Link to="/dashboard" className="text-sm text-white/60 underline decoration-white/30 hover:text-white">{t.back}</Link>
        <h1 className="mt-4 mb-6 text-3xl font-bold">{t.title}</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.search}
          className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3.5 text-base text-white placeholder-white/50 shadow-inner backdrop-blur-sm transition focus:border-white/50 focus:bg-white/15 focus:ring-2 focus:ring-indigo-300/30 focus:outline-none"
        />

        {filtered.length === 0 && entries.length > 0 && <p className="mt-8 text-center text-white/50">{t.none}</p>}

        {(['guides', 'services', 'terms'] as const).map((g) =>
          groups[g].length ? (
            <section key={g} className="mt-8">
              <h2 className="mb-3 text-lg font-semibold text-white/90">{t[g]}</h2>
              <div className="space-y-2">
                {groups[g].map((e) => (
                  <div key={e.id} className="rounded-2xl border border-white/12 bg-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setOpen(open === e.id ? null : e.id)}
                      className="flex w-full items-center justify-between px-5 py-3.5 text-left text-[15px] font-medium"
                      aria-expanded={open === e.id}
                    >
                      {e.title}
                      <span aria-hidden className="text-white/40">{open === e.id ? '−' : '+'}</span>
                    </button>
                    {open === e.id && (
                      <div className="px-5 pb-4 text-sm leading-relaxed text-white/80">
                        <p>{e.body}</p>
                        {e.related.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-xs uppercase tracking-wide text-white/40">{t.related}</span>
                            {e.related.map((r) => byId.has(r.id) && (
                              <button key={r.id} type="button" onClick={() => setOpen(r.id)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:bg-white/10">
                                {r.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null,
        )}
      </div>
    </div>
  )
}
