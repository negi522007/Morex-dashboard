import type { WidgetInstance } from '../lib/types'

interface Props {
  widget: WidgetInstance
  onEdit: () => void
  onDelete: () => void
}

export function WidgetCard({ widget, onEdit, onDelete }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="widget-drag-handle flex cursor-move items-start justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">{widget.serviceName}</p>
          <h3 className="truncate font-semibold text-gray-900">{widget.widgetName}</h3>
        </div>
        <div className="widget-actions flex shrink-0 cursor-default gap-1.5">
          <button
            onClick={onEdit}
            aria-label="Reconfigure widget"
            className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
          >
            <GearIcon />
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete widget"
            className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 text-sm text-gray-700">
        {widget.cachedData == null ? (
          <p className="text-gray-400 italic">Waiting for first refresh…</p>
        ) : (
          <WidgetData data={widget.cachedData} />
        )}
      </div>

      <p className="border-t border-gray-100 px-4 py-1.5 text-[11px] text-gray-400">
        Every {widget.refreshRateSeconds}s
        {widget.lastRefreshedAt && ` · last: ${new Date(widget.lastRefreshedAt).toLocaleTimeString()}`}
      </p>
    </div>
  )
}

function WidgetData({ data }: { data: unknown }) {
  if (Array.isArray(data)) {
    if (data.length === 0) return <p className="text-gray-400 italic">No data.</p>
    return (
      <ul className="space-y-1.5">
        {data.slice(0, 8).map((item, i) => (
          <li key={i} className="truncate border-b border-gray-100 pb-1 last:border-0">
            {typeof item === 'object' && item !== null
              ? Object.values(item as Record<string, unknown>).slice(0, 2).join(' — ')
              : String(item)}
          </li>
        ))}
      </ul>
    )
  }

  if (typeof data === 'object' && data !== null) {
    return (
      <dl className="space-y-1">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-2">
            <dt className="text-gray-400">{key}</dt>
            <dd className="truncate font-medium">{String(value)}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return <p>{String(data)}</p>
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
