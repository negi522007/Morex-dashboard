import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { apiFetch } from '../lib/api'
import type { AboutResponse, WidgetInstance } from '../lib/types'
import { Logo } from '../components/Logo'
import { WidgetCard } from '../components/WidgetCard'
import { WidgetFormModal } from '../components/WidgetFormModal'

const ReactGridLayout = WidthProvider(GridLayout)
const POLL_INTERVAL_MS = 15_000

interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [about, setAbout] = useState<AboutResponse | null>(null)
  const [widgets, setWidgets] = useState<WidgetInstance[]>([])
  const [modal, setModal] = useState<'add' | WidgetInstance | null>(null)
  const isInteractingRef = useRef(false)

  useEffect(() => {
    apiFetch<User>('/auth/me')
      .then(setUser)
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setChecking(false))
  }, [navigate])

  const loadWidgets = useCallback(() => {
    apiFetch<WidgetInstance[]>('/widgets').then((fresh) => {
      if (isInteractingRef.current) return
      setWidgets((current) => {
        const byId = new Map(current.map((w) => [w.id, w]))
        return fresh.map((w) => {
          const existing = byId.get(w.id)
          // Keep the locally-known position so an in-flight drag/resize
          // (not yet reflected server-side) never gets overwritten by a poll.
          return existing ? { ...w, position: existing.position } : w
        })
      })
    })
  }, [])

  useEffect(() => {
    if (!user) return
    apiFetch<AboutResponse>('/about.json').then(setAbout)
    loadWidgets()
    const interval = setInterval(loadWidgets, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, loadWidgets])

  async function handleLogout() {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {})
    navigate('/login', { replace: true })
  }

  function handleLinkGithub() {
    window.open('/auth/github', '_blank')
  }

  async function handleDelete(widget: WidgetInstance) {
    if (!confirm(`Delete this ${widget.widgetName} widget?`)) return
    await apiFetch(`/widgets/${widget.id}`, { method: 'DELETE' })
    setWidgets((current) => current.filter((w) => w.id !== widget.id))
  }

  function handleSaved() {
    setModal(null)
    loadWidgets()
  }

  const layout: Layout[] = useMemo(
    () =>
      widgets.map((w, index) => ({
        i: w.id,
        x: w.position.x ?? (index % 3) * 4,
        y: w.position.y ?? Math.floor(index / 3) * 3,
        w: w.position.w ?? 4,
        h: w.position.h ?? 3,
      })),
    [widgets],
  )

  function persistPosition(itemId: string, next: { x: number; y: number; w: number; h: number }) {
    setWidgets((current) => current.map((w) => (w.id === itemId ? { ...w, position: next } : w)))
    apiFetch(`/widgets/${itemId}`, { method: 'PATCH', body: JSON.stringify({ position: next }) }).catch(() => {})
  }

  if (checking || (user && !about)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (!user || !about) return null

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  const initial = (user.firstName || user.email).charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-200/70 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-semibold text-gray-900">Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-gray-100 py-1 pr-3 pl-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {initial}
              </div>
              <span className="text-sm font-medium text-gray-700">{displayName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Your widgets</h1>
            <p className="mt-1 text-sm text-gray-500">Drag to move, drag the corner to resize.</p>
          </div>
          <button
            onClick={() => setModal('add')}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            + Add widget
          </button>
        </div>

        {widgets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-12 text-center">
            <p className="text-sm text-gray-500">No widgets yet — add your first one to get started.</p>
          </div>
        ) : (
          <ReactGridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={90}
            margin={[16, 16]}
            draggableHandle=".widget-drag-handle"
            draggableCancel=".widget-actions"
            onDragStart={() => {
              isInteractingRef.current = true
            }}
            onResizeStart={() => {
              isInteractingRef.current = true
            }}
            onDragStop={(_layout, _oldItem, newItem) => {
              isInteractingRef.current = false
              persistPosition(newItem.i, { x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h })
            }}
            onResizeStop={(_layout, _oldItem, newItem) => {
              isInteractingRef.current = false
              persistPosition(newItem.i, { x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h })
            }}
          >
            {widgets.map((widget) => (
              <div key={widget.id}>
                <WidgetCard widget={widget} onEdit={() => setModal(widget)} onDelete={() => handleDelete(widget)} />
              </div>
            ))}
          </ReactGridLayout>
        )}

        <div className="mt-10 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900">
              <GithubIcon />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Connected accounts</h2>
              <p className="mt-1 text-sm text-gray-500">
                Link GitHub to raise the API rate limit for GitHub widgets (public repos only).
              </p>
              <button
                onClick={handleLinkGithub}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800"
              >
                <GithubIcon size={16} />
                Link GitHub account
              </button>
            </div>
          </div>
        </div>
      </main>

      {modal && (
        <WidgetFormModal
          about={about}
          editing={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function GithubIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="white" style={{ width: size, height: size }}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}
