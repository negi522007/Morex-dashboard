import { useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { AboutResponse, WidgetInstance } from '../lib/types'

interface Props {
  about: AboutResponse
  editing: WidgetInstance | null
  onClose: () => void
  onSaved: () => void
}

export function WidgetFormModal({ about, editing, onClose, onSaved }: Props) {
  const services = about.server.services
  const [serviceName, setServiceName] = useState(editing?.serviceName ?? services[0]?.name ?? '')
  const service = services.find((s) => s.name === serviceName)

  const [widgetName, setWidgetName] = useState(editing?.widgetName ?? service?.widgets[0]?.name ?? '')
  const widget = service?.widgets.find((w) => w.name === widgetName)

  const [config, setConfig] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    if (editing) {
      for (const [key, value] of Object.entries(editing.config)) initial[key] = String(value)
    }
    return initial
  })
  const [refreshRateSeconds, setRefreshRateSeconds] = useState(editing?.refreshRateSeconds ?? 60)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function handleServiceChange(nextServiceName: string) {
    setServiceName(nextServiceName)
    const nextService = services.find((s) => s.name === nextServiceName)
    setWidgetName(nextService?.widgets[0]?.name ?? '')
    setConfig({})
  }

  function handleWidgetChange(nextWidgetName: string) {
    setWidgetName(nextWidgetName)
    setConfig({})
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const parsedConfig: Record<string, string | number> = {}
      for (const param of widget?.params ?? []) {
        const raw = config[param.name]
        if (raw === undefined || raw === '') continue
        parsedConfig[param.name] = param.type === 'integer' ? Number(raw) : raw
      }

      if (editing) {
        await apiFetch(`/widgets/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ config: parsedConfig, refreshRateSeconds }),
        })
      } else {
        await apiFetch('/widgets', {
          method: 'POST',
          body: JSON.stringify({ serviceName, widgetName, config: parsedConfig, refreshRateSeconds }),
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Reconfigure widget' : 'Add a widget'}</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {!editing && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Service</label>
                <select
                  value={serviceName}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                >
                  {services.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Widget</label>
                <select
                  value={widgetName}
                  onChange={(e) => handleWidgetChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                >
                  {service?.widgets.map((w) => (
                    <option key={w.name} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {widget && <p className="mt-1 text-xs text-gray-500">{widget.description}</p>}
              </div>
            </>
          )}

          {editing && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              <span className="font-medium">{editing.serviceName}</span> / {editing.widgetName}
            </p>
          )}

          {widget?.params.map((param) => (
            <div key={param.name}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {param.name}
                {param.required && <span className="text-red-500"> *</span>}
              </label>
              <input
                type={param.type === 'integer' ? 'number' : 'text'}
                required={param.required}
                value={config[param.name] ?? ''}
                onChange={(e) => setConfig((c) => ({ ...c, [param.name]: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>
          ))}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Refresh rate (seconds)</label>
            <input
              type="number"
              min={10}
              required
              value={refreshRateSeconds}
              onChange={(e) => setRefreshRateSeconds(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">Minimum 10 seconds.</p>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !widget}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add widget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
