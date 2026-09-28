// `fetch` that gives up after `timeoutMs` (rejects with a TimeoutError). Used by
// the providers that call a fixed, trusted API host; anything that fetches a
// URL typed by a user must use safeFetch instead.
export function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
