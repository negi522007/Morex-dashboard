import { lookup as dnsLookupCb, promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

// Server-side requests to URLs a USER typed (an RSS link, a calendar URL, a
// custom API) are a classic SSRF hole: without a check, "http://db:5432" or
// "http://169.254.169.254/" (cloud metadata) is one form field away. Every such
// fetch goes through here. Two independent layers:
//   1. before connecting: scheme, credentials, literal IPs, and every address
//      the hostname resolves to;
//   2. at connect time (custom `lookup` on the agent): the address actually
//      dialled is checked again, which is what defeats DNS rebinding.
// Redirects are followed by hand so each hop is validated too.

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

// ---------- IP classification ----------

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isPrivateIPv4(n: number[]): boolean {
  const [a, b, c] = n;
  return (
    a === 0 || // "this" network
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    a === 127 ||
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

// Expands an IPv6 literal into 8 16-bit groups (handles "::" and a trailing dotted IPv4).
function parseIPv6(ip: string): number[] | null {
  let s = ip.split('%')[0].toLowerCase();
  let tail: number[] = [];
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const v4 = parseIPv4(dotted[1]);
    if (!v4) return null;
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    s = s.slice(0, -dotted[1].length) + '0:0';
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part === '' ? [] : part.split(':').map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN)));
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  let groups: number[];
  if (halves.length === 2) {
    const missing = 8 - head.length - rest.length;
    if (missing < 0) return null;
    groups = [...head, ...new Array(missing).fill(0), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g))) return null;
  if (tail.length) {
    groups[6] = tail[0];
    groups[7] = tail[1];
  }
  return groups;
}

export function isPrivateAddress(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4) return isPrivateIPv4(v4);

  const g = parseIPv6(ip);
  if (!g) return true; // unparseable -> refuse
  const embedded = (hi: number, lo: number) => isPrivateIPv4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return embedded(g[6], g[7]); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return embedded(g[6], g[7]); // NAT64
  if (g[0] === 0x2002) return embedded(g[1], g[2]); // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

// ---------- URL validation ----------

const allowPrivateFromEnv = () => process.env.ALLOW_PRIVATE_FETCH === 'true';

type Resolver = (hostname: string) => Promise<string[]>;
const defaultResolver: Resolver = async (hostname) => (await dns.lookup(hostname, { all: true })).map((a) => a.address);

export function parseUserUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('Only http and https URLs are allowed');
  if (url.username || url.password) throw new UnsafeUrlError('URLs with embedded credentials are not allowed');
  return url;
}

async function assertPublicHost(url: URL, resolver: Resolver): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError('That address is not allowed (private or internal network)');
    return;
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new UnsafeUrlError('That address is not allowed (private or internal network)');
  }
  let addresses: string[];
  try {
    addresses = await resolver(host);
  } catch {
    throw new UnsafeUrlError(`Could not resolve host "${host}"`);
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new UnsafeUrlError('That address is not allowed (private or internal network)');
  }
}

// ---------- fetching ----------

// Node calls `lookup` either as (err, address, family) or, with `all`, (err, [{address, family}]).
function guardedLookup(hostname: string, options: any, callback: (...args: any[]) => void) {
  dnsLookupCb(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as unknown as { address: string; family: number }[];
    if (list.some((a) => isPrivateAddress(a.address))) {
      return callback(new UnsafeUrlError('That address is not allowed (private or internal network)'));
    }
    if (options?.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

const publicOnlyAgent = new Agent({ connect: { lookup: guardedLookup as any } });

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: string;
}

export interface SafeResponse {
  ok: boolean;
  status: number;
  url: string;
  contentType: string;
  text: string;
}

export interface SafeFetcherDeps {
  fetchImpl?: (url: string, init: any) => Promise<Response>;
  resolver?: Resolver;
  allowPrivate?: boolean;
}

async function readLimited(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new UnsafeUrlError(`Response is larger than ${Math.round(maxBytes / 1024)} KB`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createSafeFetcher(deps: SafeFetcherDeps = {}) {
  const resolver = deps.resolver ?? defaultResolver;
  return async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> {
    const allowPrivate = deps.allowPrivate ?? allowPrivateFromEnv();
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
    const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    const doFetch = deps.fetchImpl ?? ((url: string, init: any) => undiciFetch(url, init) as unknown as Promise<Response>);

    let current = parseUserUrl(rawUrl);
    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (!allowPrivate) await assertPublicHost(current, resolver);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const init: Record<string, unknown> = {
          method: opts.method ?? 'GET',
          headers: { 'User-Agent': 'dashboard-app/1.0', Accept: '*/*', ...(opts.headers ?? {}) },
          body: opts.body,
          redirect: 'manual',
          signal: controller.signal,
        };
        if (!allowPrivate && !deps.fetchImpl) init.dispatcher = publicOnlyAgent;
        const res = await doFetch(current.toString(), init);

        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
          await res.body?.cancel().catch(() => undefined);
          current = parseUserUrl(new URL(res.headers.get('location')!, current).toString());
          continue;
        }
        const text = await readLimited(res, maxBytes);
        return { ok: res.ok, status: res.status, url: current.toString(), contentType: res.headers.get('content-type') ?? '', text };
      } finally {
        clearTimeout(timer);
      }
    }
    throw new UnsafeUrlError('Too many redirects');
  };
}

export const safeFetch = createSafeFetcher();
