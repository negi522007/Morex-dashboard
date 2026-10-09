import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Lang } from '../../lib/i18n'
import { ago } from '../../lib/format'
import { CATALOG, SERVICES } from '../../lib/catalog'
import type { WidgetPosition } from '../../lib/types'
import type { AdminTexts, AdminUser } from './shared'

// GET /admin/users/:id/widgets: what each widget is and where it sits, never its config or data
interface AdminWidget {
  id: string
  serviceName: string
  widgetName: string
  title: string | null
  position: WidgetPosition | null
  refreshRateSeconds: number
  lastRefreshedAt: string | null
  lastError: string | null
  createdAt: string
}

// Same default sizes as the dashboard's cards (morex.css): wide cards span 2 columns, most are 2 rows
// high, a few are taller. A size the user picked (position.cols / rows) wins.
const TALL: Record<string, number> = {
  rss: 4, 'gh-daily': 3, 'gh-stats': 3, 'gh-issues': 3, weather: 3, 'wx-now': 3, cal: 3,
  'yt-channel': 3, 'yt-video': 3, horo: 3, 'api-list': 3, 'epi-plan': 3, 'epi-prof': 3,
}
// GitHub's black would vanish on the dark background
const colorOf = (service: string) => (service === 'github' ? '#a78bfa' : SERVICES[service]?.color ?? '#94a3b8')

// "Ses widgets": a miniature of the user's dashboard, in their order and sizes, each card in its
// service's colours, with a red dot on the ones whose last refresh failed (hover for the details)
export function DashboardPreview({ u, t, lang }: { u: AdminUser; t: AdminTexts; lang: Lang }) {
  const [list, setList] = useState<AdminWidget[] | null>(null)
  useEffect(() => {
    let alive = true
    api.get<AdminWidget[]>(`/admin/users/${u.id}/widgets`).then((l) => alive && setList(l)).catch(() => alive && setList([]))
    return () => { alive = false }
  }, [u.id])

  if (!list) return <div className="adm-wsec"><div className="adm-sessions-title">{t.hisWidgets}</div><div className="adm-muted">…</div></div>
  const sorted = [...list].sort((a, b) => (a.position?.order ?? 1e9) - (b.position?.order ?? 1e9) || a.createdAt.localeCompare(b.createdAt))
  const errors = list.filter((w) => w.lastError).length

  return (
    <div className="adm-wsec">
      <div className="adm-wsec-head">
        <span className="adm-sessions-title">{t.hisWidgets}</span>
        {list.length > 0 && <span className="adm-badge ok">● {t.widgetsOk(list.length - errors)}</span>}
        {errors > 0 && <span className="adm-badge ban">⚠ {t.widgetsKo(errors)}</span>}
      </div>
      {!list.length ? <div className="adm-muted">{t.noWidgetYet}</div> : (
        <div className="adm-mini">
          {sorted.map((w) => {
            const entry = CATALOG.find((e) => e.service === w.serviceName && e.widget === w.widgetName)
            const cols = Math.min(2, w.position?.cols ?? (entry?.wide ? 2 : 1))
            const rows = w.position?.rows ?? (entry ? TALL[entry.kind] ?? 2 : 2)
            const svc = SERVICES[w.serviceName], c = colorOf(w.serviceName)
            const kind = entry?.name[lang] ?? w.widgetName
            const tip = [`${svc?.label[lang] ?? w.serviceName} · ${kind}`, w.lastError ? `⚠ ${w.lastError}` : w.lastRefreshedAt ? t.refreshed(ago(w.lastRefreshedAt, lang)) : ''].filter(Boolean).join('\n')
            return (
              <div key={w.id} className={`adm-mt ${w.lastError ? 'err' : ''}`} title={tip}
                style={{ '--c': c, gridColumn: `span ${cols}`, gridRow: `span ${rows}` } as React.CSSProperties}>
                <span className="adm-mt-ic">{svc?.icon ?? '◌'}</span>
                <span className="adm-mt-txt"><b>{w.title || kind}</b>{w.title && <small>{kind}</small>}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
