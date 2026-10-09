import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { LANGS, W, tr, type Lang } from '../lib/i18n'
import { setAuthLang } from '../lib/authLang'
import { entryFor, type CatalogEntry } from '../lib/catalog'
import type { AboutResponse, User, WidgetInstance } from '../lib/types'
import { Hero, SearchBar, Sidebar, Toolbar } from '../components/morex/Chrome'
import { WidgetGrid } from '../components/morex/WidgetGrid'
import { AiBubble } from '../components/morex/AiBubble'
import { Drawer } from '../components/morex/Drawer'
import { LinkedCard, readLinkResult, type LinkResult } from '../components/morex/LinkedCard'
import { AvatarModal, BioModal, EditWidgetModal, HelpModal, JournalModal, LogoutModal, ProfileModal } from '../components/morex/Modals'
import '../styles/morex.css'

// The widgets' data is refreshed server-side by the Timer; the page just re-reads GET /widgets.
const POLL_INTERVAL_MS = 5_000
type ModalName = 'profile' | 'avatar' | 'journal' | 'help' | 'logout' | 'bio'

const byOrder = (a: WidgetInstance, b: WidgetInstance) =>
  (a.position?.order ?? Number.MAX_SAFE_INTEGER) - (b.position?.order ?? Number.MAX_SAFE_INTEGER) || a.createdAt.localeCompare(b.createdAt)

export function DashboardPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [about, setAbout] = useState<AboutResponse | null>(null)
  const [widgets, setWidgets] = useState<WidgetInstance[]>([])
  const [collapsed, setCollapsed] = useState(true)
  // Below 900px the sidebar is off-canvas (morex.css) — this is purely "is the slide-in overlay open",
  // unrelated to `collapsed` (the desktop icon-rail toggle, which doesn't apply on mobile at all).
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [modal, setModal] = useState<ModalName | null>(null)
  // A question the help chat asks by itself when it opens ("why is my widget empty?" from an empty card)
  const [helpAsk, setHelpAsk] = useState('')
  const [editWidget, setEditWidget] = useState<WidgetInstance | null>(null)
  const [drawer, setDrawer] = useState<{ open: boolean; preset: CatalogEntry | null; service?: string | null }>({ open: false, preset: null })
  const [landing, setLanding] = useState<string | null>(null)
  // Deleting waits 5 s so "Undo" can bring the card back without re-creating it (secrets stay stored)
  const [removed, setRemoved] = useState<{ widget: WidgetInstance; timer: number } | null>(null)
  const removedRef = useRef(removed)
  removedRef.current = removed
  // Back from connecting GitHub / My Epitech / Microsoft: the result is in the address. It is read once, then
  // removed from the address so a reload does not show the card again.
  const [linkResult, setLinkResult] = useState<LinkResult | null>(() => readLinkResult(window.location.search))
  useEffect(() => { if (linkResult) window.history.replaceState(null, '', window.location.pathname) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const lang: Lang = LANGS.includes(user?.language as Lang) ? (user!.language as Lang) : 'fr'
  const theme = user?.theme ?? 'galaxy', skin = user?.widgetSkin ?? 'glass'

  useEffect(() => {
    api.get<User>('/auth/me').then(setUser).catch(() => navigate('/login', { replace: true }))
    api.get<AboutResponse>('/about.json').then(setAbout).catch(() => {})
  }, [navigate])

  const loadWidgets = useCallback(() => {
    api.get<WidgetInstance[]>('/widgets').then((list) => setWidgets([...list].sort(byOrder))).catch(() => {})
  }, [])
  useEffect(() => {
    if (!user) return
    loadWidgets()
    const id = setInterval(loadWidgets, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [user?.id, loadWidgets]) // eslint-disable-line react-hooks/exhaustive-deps

  // Page-level look of the mockup: theme picture, widget skin, edit / drawer states live on <body>
  useEffect(() => {
    document.body.classList.add('morex')
    return () => {
      document.body.classList.remove('morex', 'editing', 'dw-open', 'theme-in')
      delete document.body.dataset.theme
      delete document.body.dataset.wskin
    }
  }, [])
  useEffect(() => {
    document.body.dataset.theme = theme
    document.body.classList.remove('theme-in'); void document.body.offsetWidth; document.body.classList.add('theme-in')
  }, [theme])
  useEffect(() => { document.body.dataset.wskin = skin }, [skin])
  useEffect(() => { document.body.classList.toggle('editing', editing) }, [editing])
  useEffect(() => { document.body.classList.toggle('dw-open', drawer.open) }, [drawer.open])
  // Also remembered for the login page, so logging out keeps the same language
  useEffect(() => { document.documentElement.lang = lang; if (user) setAuthLang(lang) }, [lang, user])

  // Leave edit mode with Escape or a click outside the cards
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(false)
    const onClick = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.w, .modal-bg, .dw, .dw-toast')) setEditing(false) }
    document.addEventListener('keydown', onKey); document.addEventListener('click', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick) }
  }, [editing])

  // Preferences are saved on the account, so they follow the user on every device
  const savePrefs = (patch: Partial<Pick<User, 'language' | 'theme' | 'widgetSkin'>>) => {
    setUser((u) => (u ? { ...u, ...patch } : u))
    api.patch('/auth/me', patch).catch(() => {})
  }

  const patchWidget = async (w: WidgetInstance, patch: Partial<WidgetInstance>) => {
    const updated = await api.patch<WidgetInstance>(`/widgets/${w.id}`, patch)
    setWidgets((list) => list.map((x) => (x.id === w.id ? { ...x, ...updated } : x)))
  }
  // A new config (or AI switch) is fetched at the Timer's next tick: re-read a few times so it shows quickly
  const pollSoon = () => [2000, 6000, 12000, 18000].forEach((ms) => setTimeout(loadWidgets, ms))

  function reorder(ids: string[]) {
    const pos = new Map(ids.map((id, i) => [id, i]))
    const next = widgets.map((w) => ({ ...w, position: { ...w.position, order: pos.get(w.id) ?? w.position?.order } }))
    // Only the cards whose rank changed are saved
    next.forEach((w, i) => { if (widgets[i].position?.order !== w.position.order) api.patch(`/widgets/${w.id}`, { position: w.position }).catch(() => {}) })
    setWidgets(next.sort(byOrder))
  }

  function resize(w: WidgetInstance, cols: number, rows: number) {
    const position = { ...w.position, cols, rows }
    setWidgets((list) => list.map((x) => (x.id === w.id ? { ...x, position } : x)))
    api.patch(`/widgets/${w.id}`, { position }).catch(() => {})
  }

  function commitRemoval(r: { widget: WidgetInstance; timer: number } | null) {
    if (!r) return
    clearTimeout(r.timer)
    api.del(`/widgets/${r.widget.id}`).catch(() => loadWidgets())
  }
  function removeWithUndo(w: WidgetInstance) {
    commitRemoval(removedRef.current)
    const timer = window.setTimeout(() => { commitRemoval({ widget: w, timer }); setRemoved(null) }, 5000)
    setRemoved({ widget: w, timer })
  }
  function undo() {
    if (!removed) return
    clearTimeout(removed.timer)
    setLanding(removed.widget.id); setTimeout(() => setLanding(null), 2700)
    setRemoved(null)
  }
  // Don't lose a pending delete when leaving the page
  useEffect(() => () => commitRemoval(removedRef.current), [])

  async function create(entry: CatalogEntry, config: Record<string, string | number>, refreshRateSeconds: number) {
    const order = Math.max(-1, ...widgets.map((w) => w.position?.order ?? -1)) + 1
    const created = await api.post<WidgetInstance>('/widgets', { serviceName: entry.service, widgetName: entry.widget, config, refreshRateSeconds, position: { order } })
    setDrawer({ open: false, preset: null })
    setTimeout(() => {
      setWidgets((list) => [...list, created].sort(byOrder))
      setLanding(created.id)
      setTimeout(() => document.querySelector(`[data-id="${created.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      setTimeout(() => setLanding(null), 2700)
    }, 350)
    pollSoon()
  }

  function goToWidget(id: string) {
    document.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setLanding(id); setTimeout(() => setLanding(null), 2700)
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {})
    navigate('/login', { replace: true })
  }

  if (!user) return null
  const visible = widgets.filter((w) => w.id !== removed?.widget.id)
  const removedName = removed ? removed.widget.title || entryFor(removed.widget.serviceName, removed.widget.widgetName)?.name[lang] || 'Widget' : ''

  return (
    <>
      <div className={`A${collapsed ? ' collapsed' : ''}`}>
        <Sidebar lang={lang} isAdmin={user?.isAdmin} mobileOpen={mobileNavOpen} onToggle={() => setCollapsed((c) => !c)} onCloseMobile={() => setMobileNavOpen(false)} onProfile={() => setModal('profile')} onAdmin={() => navigate('/admin')} onHelp={() => setModal('help')} onLegal={() => navigate('/terms')} onLogout={() => setModal('logout')} />
        <main>
          <div className="top-row">
            <button type="button" className="mnav-btn" aria-label={tr(lang).navMenu} onClick={() => setMobileNavOpen(true)}>
              <svg className="i" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <Toolbar user={user} lang={lang} theme={theme} skin={skin} onLang={(l) => savePrefs({ language: l })} onTheme={(t) => savePrefs({ theme: t })} onSkin={(s) => savePrefs({ widgetSkin: s })} onOpen={setModal} />
          </div>
          <Hero user={user} lang={lang} onAvatar={() => setModal('avatar')} onBio={() => setModal('bio')} onJournal={() => setModal('journal')} />
          <SearchBar lang={lang} widgets={visible} onGoWidget={goToWidget} onAdd={(e) => setDrawer({ open: true, preset: e })} />
          <WidgetGrid widgets={visible} lang={lang} linked={{ github: user.githubLinked, epitech: !!user.epitech }} onWhy={() => { setHelpAsk(W[lang].whyEmpty); setModal('help') }} editing={editing} setEditing={setEditing} landing={landing}
            onAdd={() => setDrawer({ open: true, preset: null })} onDelete={removeWithUndo} onEdit={setEditWidget}
            onConfig={(w, patch) => { patchWidget(w, { config: { ...w.config, ...patch } }).then(pollSoon).catch(() => {}) }}
            onReorder={reorder} onResize={resize} />
        </main>
      </div>

      <AiBubble user={user} lang={lang} onCreate={create} />

      <Drawer open={drawer.open} lang={lang} about={about} user={user} preset={drawer.preset} service={drawer.service} onClose={() => setDrawer({ open: false, preset: null })} onCreate={create} />

      <div className={`dw-toast${removed ? ' show' : ''}`} role="status">
        <span>{W[lang].removed(removedName)}</span><button onClick={undo}>{W[lang].undo}</button><span className="bar" key={removed?.widget.id} />
      </div>

      {editWidget && (
        <EditWidgetModal widget={editWidget} about={about} user={user} lang={lang} onClose={() => setEditWidget(null)}
          onSave={async (patch) => { await patchWidget(editWidget, patch); if (patch.config || patch.aiEnabled) pollSoon() }} />
      )}
      {modal === 'help' && <HelpModal lang={lang} initialQuestion={helpAsk} onClose={() => { setModal(null); setHelpAsk('') }} />}
      {modal === 'logout' && <LogoutModal lang={lang} onClose={() => setModal(null)} onLogout={logout} />}
      {modal === 'journal' && <JournalModal lang={lang} onClose={() => setModal(null)} />}
      {modal === 'profile' && (
        <ProfileModal user={user} lang={lang} theme={theme} onClose={() => setModal(null)} onSaved={setUser}
          onLang={(l) => savePrefs({ language: l })} onTheme={(t) => savePrefs({ theme: t })} onAvatar={() => setModal('avatar')} />
      )}
      {modal === 'bio' && <BioModal user={user} lang={lang} onClose={() => setModal(null)} onSaved={setUser} />}
      {modal === 'avatar' && <AvatarModal user={user} lang={lang} onClose={() => setModal(null)} onSaved={setUser} />}
      {linkResult && (
        <LinkedCard result={linkResult} lang={lang} onClose={() => setLinkResult(null)}
          onAddWidget={() => { setLinkResult(null); setDrawer({ open: true, preset: null, service: 'github' }) }} />
      )}
    </>
  )
}
