import { useEffect, useRef, useState } from 'react'
import { LOCALE, W, tr, type Lang } from '../../lib/i18n'
import { entryFor, rateLabel } from '../../lib/catalog'
import type { WidgetInstance } from '../../lib/types'
import { VIEWS } from './widgetViews'
import { Decoration } from './Decoration'

// The card frame shared by every widget: edit badges, resize handle, decoration, footer.
export function WidgetCard({ widget, lang, editing = false, className = '', style, onDelete, onEdit, onConfig, onResizeStart, dragProps, preview, unlinked }: {
  widget: Pick<WidgetInstance, 'serviceName' | 'widgetName' | 'config' | 'cachedData' | 'insight' | 'title' | 'decoration' | 'refreshRateSeconds' | 'lastRefreshedAt'> & { id?: string }
  lang: Lang
  editing?: boolean
  className?: string
  style?: React.CSSProperties
  onDelete?: () => void
  onEdit?: () => void
  onConfig?: (patch: Record<string, string | number>) => void
  onResizeStart?: (e: React.PointerEvent) => void
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean }
  preview?: boolean
  // The account this widget reads (GitHub) is not connected: the card asks to connect it instead of waiting
  unlinked?: boolean
}) {
  const entry = entryFor(widget.serviceName, widget.widgetName)
  const kind = entry?.kind ?? 'unknown'
  const view = VIEWS[kind]
  const at = widget.lastRefreshedAt ? new Date(widget.lastRefreshedAt).toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' }) : ''
  const footer = view?.foot ? <div className="w-foot"><span>{W[lang].every} {rateLabel(widget.refreshRateSeconds)}</span><span>{at}</span></div> : undefined
  return (
    <div className={`glass w ${view?.cls ?? ''} ${className}`} data-kind={kind} data-id={widget.id} style={style} {...dragProps}>
      {!preview && <Decoration name={widget.decoration} />}
      {!preview && (
        <>
          <button className="badge del" aria-label="−" onClick={(e) => { e.stopPropagation(); onDelete?.() }}>−</button>
          <button className="badge edit" aria-label="✎" onClick={(e) => { e.stopPropagation(); onEdit?.() }}>✎</button>
          <button className="resize" aria-label="↘" onPointerDown={onResizeStart}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 13v8h-8M21 21l-8-8M3 11V3h8M3 3l8 8" /></svg>
          </button>
        </>
      )}
      {unlinked && entry?.needs ? (
        <div className="w-unlinked">
          <span aria-hidden="true">🔌</span>
          <b>{W[lang].unlinkedTitle(entry.needs === 'github' ? 'GitHub' : 'My Epitech')}</b>
          <small>{W[lang].unlinkedText}</small>
          <a href={`/auth/${entry.needs}`} onClick={(e) => e.stopPropagation()}>{entry.needs === 'github' ? W[lang].connectGithub : W[lang].connectEpitech}</a>
        </div>
      ) : view ? (
        <view.View data={widget.cachedData} insight={widget.insight} config={widget.config} lang={lang} title={widget.title} footer={footer} onConfig={editing ? undefined : onConfig} />
      ) : (
        <div className="w-title">{widget.serviceName} / {widget.widgetName}</div>
      )}
    </div>
  )
}

const spanStyle = (w: WidgetInstance): React.CSSProperties => ({
  ...(w.position?.cols ? { gridColumn: `span ${w.position.cols}` } : {}),
  ...(w.position?.rows ? { gridRow: `span ${w.position.rows}` } : {}),
})

export function WidgetGrid({ widgets, lang, linked, editing, setEditing, landing, onAdd, onDelete, onEdit, onConfig, onReorder, onResize }: {
  widgets: WidgetInstance[]
  // Which accounts are connected (from GET /auth/me), for the widgets that need one
  linked: { github: boolean; epitech: boolean }
  lang: Lang
  editing: boolean
  setEditing: (on: boolean) => void
  landing: string | null
  onAdd: () => void
  onDelete: (w: WidgetInstance) => void
  onEdit: (w: WidgetInstance) => void
  onConfig: (w: WidgetInstance, patch: Record<string, string | number>) => void
  onReorder: (ids: string[]) => void
  onResize: (w: WidgetInstance, cols: number, rows: number) => void
}) {
  const t = tr(lang)
  const [order, setOrder] = useState<string[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const [sizes, setSizes] = useState<Record<string, { cols: number; rows: number }>>({})
  const [resizing, setResizing] = useState<string | null>(null)
  const [pressing, setPressing] = useState<string | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)

  // Follow the server list, but keep the local order while a drag is in progress
  useEffect(() => { if (!dragging) setOrder(widgets.map((w) => w.id)) }, [widgets, dragging])
  const byId = new Map(widgets.map((w) => [w.id, w]))
  const list = order.map((id) => byId.get(id)).filter((w): w is WidgetInstance => !!w)

  // ---- Long press (550 ms) enters edit mode, like on an iPhone home screen
  const cancelPress = () => { if (press.current) clearTimeout(press.current.timer); press.current = null; setPressing(null) }
  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (editing || (e.target as HTMLElement).closest('.badge, .resize, button, input')) return
    setPressing(id)
    press.current = { x: e.clientX, y: e.clientY, timer: window.setTimeout(() => { setPressing(null); setEditing(true); navigator.vibrate?.(30) }, 550) }
  }
  const onPointerMove = (e: React.PointerEvent) => { if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) cancelPress() }

  // ---- Drag to reorder (edit mode only)
  const dragProps = (id: string) => ({
    draggable: editing && resizing !== id,
    onDragStart: () => setDragging(id),
    onDragEnd: () => { setDragging(null); onReorder(order) },
    onDragOver: (e: React.DragEvent) => {
      if (!dragging || dragging === id) return
      e.preventDefault()
      setOrder((cur) => {
        const from = cur.indexOf(dragging), to = cur.indexOf(id)
        if (from < 0 || to < 0) return cur
        const next = cur.filter((x) => x !== dragging)
        next.splice(to, 0, dragging)
        return next
      })
    },
  })

  // ---- Resize with the ↘ handle: the card snaps to whole grid cells (columns 1..n, rows 2..5)
  const startResize = (e: React.PointerEvent, w: WidgetInstance) => {
    e.preventDefault(); e.stopPropagation()
    const card = (e.currentTarget as HTMLElement).closest('.w') as HTMLElement, cs = getComputedStyle(grid.current!)
    const cols = cs.gridTemplateColumns.split(' '), rect = card.getBoundingClientRect()
    const m = { x: e.clientX, y: e.clientY, cols: cols.length, colW: parseFloat(cols[0]), gap: parseFloat(cs.columnGap), rowH: parseFloat(cs.gridAutoRows), rgap: parseFloat(cs.rowGap) }
    const minCols = entryFor(w.serviceName, w.widgetName)?.kind === 'world' ? 2 : 1
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
    let last = { cols: 0, rows: 0 }
    setResizing(w.id)
    const move = (ev: PointerEvent) => {
      last = {
        cols: clamp(Math.round((rect.width + ev.clientX - m.x + m.gap) / (m.colW + m.gap)), minCols, m.cols),
        rows: clamp(Math.round((rect.height + ev.clientY - m.y + m.rgap) / (m.rowH + m.rgap)), 2, 5),
      }
      setSizes((s) => ({ ...s, [w.id]: last }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      setResizing(null)
      if (last.cols) onResize(w, last.cols, last.rows)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  return (
    <div className="widgets" ref={grid}>
      {list.map((w) => {
        const live = sizes[w.id]
        const style = live ? { gridColumn: `span ${live.cols}`, gridRow: `span ${live.rows}` } : spanStyle(w)
        const cls = [pressing === w.id && 'pressing', dragging === w.id && 'dragging', resizing === w.id && 'resizing', landing === w.id && 'landing'].filter(Boolean).join(' ')
        return (
          <WidgetCard key={w.id} widget={w} lang={lang} editing={editing} className={cls} style={style}
            unlinked={(entryFor(w.serviceName, w.widgetName)?.needs === 'github' && !linked.github) || (entryFor(w.serviceName, w.widgetName)?.needs === 'epitech' && !linked.epitech)}
            onDelete={() => onDelete(w)} onEdit={() => onEdit(w)} onConfig={(p) => onConfig(w, p)} onResizeStart={(e) => startResize(e, w)}
            dragProps={{ ...dragProps(w.id), onPointerDown: (e) => onPointerDown(e, w.id), onPointerMove, onPointerUp: cancelPress, onPointerCancel: cancelPress }} />
        )
      })}
      <div className="glass w add" role="button" tabIndex={0} onClick={onAdd} onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        onDragOver={(e) => { if (dragging) { e.preventDefault(); setOrder((cur) => [...cur.filter((x) => x !== dragging), dragging]) } }}>
        <div className="plus">+</div><div style={{ fontWeight: 500 }}>{t.addWidget}</div><div className="w-sub">{t.addHint}</div>
      </div>
    </div>
  )
}
