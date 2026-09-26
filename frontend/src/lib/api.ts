export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // A FormData body (photo upload) must let the browser set its own multipart Content-Type
  const isForm = options.body instanceof FormData
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...(options.headers ?? {}) },
  })

  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const body = isJson ? await res.json().catch(() => null) : await res.text()

  if (!res.ok) {
    const rawMessage = isJson && body && typeof body === 'object' ? body.message : String(body)
    const message = rawMessage && String(rawMessage).trim() ? String(rawMessage) : `Request failed (HTTP ${res.status})`
    throw new ApiError(res.status, message)
  }

  return body as T
}

// Small helpers so components read like the REST calls they make
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path: string) => apiFetch<void>(path, { method: 'DELETE' }),
}
