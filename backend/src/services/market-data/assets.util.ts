import { fetchWithTimeout } from '../../common/fetch-timeout.util';
import { marketCache } from './market-data.provider';

// Type-ahead for "base"/"quote"/"asset"/"currency": real currency codes (ECB, via the same Frankfurter
// API the exchange-rate widget itself uses) and real crypto ids (CoinGecko's full coin list). Both are
// cached for a day — currencies and coin ids barely change, and CoinGecko's free tier is rate-limited.

export type AssetKind = 'fiat' | 'crypto' | 'all';
export interface AssetSuggestion {
  value: string;
  label: string;
  kind: 'fiat' | 'crypto';
}

const CURRENCIES_URL = 'https://api.frankfurter.dev/v1/currencies';
const COINS_URL = 'https://api.coingecko.com/api/v3/coins/list';
const DAY_MS = 24 * 3600_000;

async function fiatCurrencies(): Promise<Record<string, string>> {
  return marketCache.get('assets:fiat-currencies', DAY_MS, async () => {
    const res = await fetchWithTimeout(CURRENCIES_URL, {}, 10_000);
    if (!res.ok) throw new Error(`currencies HTTP ${res.status}`);
    return res.json();
  });
}

async function cryptoCoins(): Promise<{ id: string; symbol: string; name: string }[]> {
  return marketCache.get('assets:crypto-coins', DAY_MS, async () => {
    const res = await fetchWithTimeout(COINS_URL, {}, 15_000);
    if (!res.ok) throw new Error(`coins list HTTP ${res.status}`);
    return res.json();
  });
}

// Lower is a better match; null = no match at all.
function scoreCoin(q: string, id: string, symbol: string, name: string): number | null {
  if (symbol === q) return 0;
  if (id === q) return 1;
  if (symbol.startsWith(q)) return 2;
  if (name.startsWith(q)) return 3;
  if (id.startsWith(q)) return 4;
  if (name.includes(q)) return 5;
  return null;
}

// Turns a loosely typed name ("Ether", "Doge") into the CoinGecko id ("ethereum", "dogecoin") the market
// widgets actually need, for a config that was free-typed instead of picked from the suggestions. `null`
// when nothing matches (including when the input is already a valid, unknown-to-search id).
export async function resolveCryptoId(nameOrId: string): Promise<string | null> {
  const hit = await searchAssets(nameOrId, 'crypto', 1);
  return hit[0]?.value ?? null;
}

export async function searchAssets(query: string, kind: AssetKind = 'all', limit = 10): Promise<AssetSuggestion[]> {
  const q = query.trim().toLowerCase();
  const max = Math.min(Math.max(Math.floor(limit) || 10, 1), 25);
  const out: AssetSuggestion[] = [];

  if (kind !== 'crypto') {
    const fiatBudget = kind === 'fiat' ? max : Math.min(6, max);
    const currencies = await fiatCurrencies().catch(() => ({}) as Record<string, string>);
    for (const [code, name] of Object.entries(currencies)) {
      if (out.length >= fiatBudget) break;
      const c = code.toLowerCase();
      if (!q || c.startsWith(q) || name.toLowerCase().includes(q)) out.push({ value: c, label: `${code} — ${name}`, kind: 'fiat' });
    }
  }

  // Scanning 21k+ coins on an empty/one-letter query would be slow and useless — wait for a real query.
  if (kind !== 'fiat' && q.length >= 2) {
    const coins = await cryptoCoins().catch(() => [] as { id: string; symbol: string; name: string }[]);
    const scored: { c: (typeof coins)[number]; s: number }[] = [];
    for (const c of coins) {
      const s = scoreCoin(q, c.id.toLowerCase(), c.symbol.toLowerCase(), c.name.toLowerCase());
      if (s !== null) scored.push({ c, s });
    }
    scored.sort((a, b) => a.s - b.s || a.c.name.length - b.c.name.length);
    for (const { c } of scored) {
      if (out.length >= max) break;
      out.push({ value: c.id, label: `${c.name} (${c.symbol.toUpperCase()})`, kind: 'crypto' });
    }
  }

  return out.slice(0, max);
}
