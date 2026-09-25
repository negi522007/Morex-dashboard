interface Entry {
  value: unknown;
  at: number;
}

// Shared by every widget that hits the same free third-party API: identical
// requests inside the TTL are answered from memory, concurrent identical
// requests share one call, and when the upstream fails (typically an HTTP 429
// on a free tier) the last known value is served instead of an error — for up
// to `staleMs` — so a widget keeps drawing rather than going blank.
export class TtlCache {
  private entries = new Map<string, Entry>();
  private inflight = new Map<string, Promise<unknown>>();

  async get<T>(key: string, ttlMs: number, loader: () => Promise<T>, staleMs = 60 * 60_000): Promise<T> {
    const hit = this.entries.get(key);
    const now = Date.now();
    if (hit && now - hit.at < ttlMs) return hit.value as T;

    const running = this.inflight.get(key);
    if (running) return running as Promise<T>;

    const promise = loader()
      .then((value) => {
        this.entries.set(key, { value, at: Date.now() });
        return value;
      })
      .catch((err) => {
        if (hit && now - hit.at < staleMs) return hit.value as T;
        throw err;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }
}
