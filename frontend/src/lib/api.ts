export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
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
