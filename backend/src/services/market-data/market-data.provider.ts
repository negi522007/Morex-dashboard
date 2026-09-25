import { Injectable } from '@nestjs/common';
import { ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';
import { TtlCache } from '../../common/ttl-cache.util';

const FETCH_TIMEOUT_MS = 10_000;
const BASE_URL = 'https://api.coingecko.com/api/v3';

// CoinGecko's free tier answers HTTP 429 after only a handful of calls a
// minute, and every widget refreshes on its own timer — so identical requests
// are shared and cached (and a stale value is served if the API refuses).
export const marketCache = new TtlCache();
const PRICE_TTL_MS = 2 * 60_000;
const HISTORY_TTL_MS = 10 * 60_000;
const FIAT_TTL_MS = 60 * 60_000; // ECB publishes once a day

async function fetchJsonUncached(url: string, widgetName: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    throw new ServiceFetchError('market_data', widgetName, `Could not reach market data API: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    throw new ServiceFetchError('market_data', widgetName, `Market data API returned HTTP ${res.status}`);
  }
  return res.json();
}

const fetchJson = (url: string, widgetName: string, ttlMs: number): Promise<any> =>
  marketCache.get(url, ttlMs, () => fetchJsonUncached(url, widgetName));

interface HistoryPoint {
  timestamp: string;
  price: number;
}

const FIAT_CODE = /^[a-z]{3}$/;
const DEFAULT_HISTORY_DAYS = 7;

// ECB reference rates via Frankfurter (free, no key). Returns null when the
// pair isn't a fiat pair it knows (404/422) so the caller can fall back to
// CoinGecko — "eur"/"usd" are fiat, "bitcoin"/"usd" is not.
async function fetchFiatSeries(base: string, quote: string, days: number): Promise<HistoryPoint[] | null> {
  const day = new Date().toISOString().slice(0, 10);
  return marketCache.get(`fiat:${base}:${quote}:${days}:${day}`, FIAT_TTL_MS, () => fetchFiatSeriesUncached(base, quote, days));
}

async function fetchFiatSeriesUncached(base: string, quote: string, days: number): Promise<HistoryPoint[] | null> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const url = `https://api.frankfurter.dev/v1/${iso(start)}..${iso(end)}?base=${base.toUpperCase()}&symbols=${quote.toUpperCase()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    throw new ServiceFetchError('market_data', 'exchange_rate', `Could not reach market data API: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) {
    throw new ServiceFetchError('market_data', 'exchange_rate', `Market data API returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as { rates?: Record<string, Record<string, number>> };
  const points = Object.entries(data.rates ?? {})
    .map(([date, r]) => ({ timestamp: `${date}T00:00:00.000Z`, price: r[quote.toUpperCase()] }))
    .filter((p) => typeof p.price === 'number')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return points.length > 0 ? points : null;
}

function summarize(base: string, quote: string, days: number, history: HistoryPoint[], rate: number) {
  const prices = history.map((p) => p.price);
  const first = prices[0] ?? rate;
  return {
    base,
    quote,
    rate,
    asOf: new Date().toISOString(),
    days,
    history,
    min: prices.length ? Math.min(...prices) : rate,
    max: prices.length ? Math.max(...prices) : rate,
    changePct: first ? ((rate - first) / first) * 100 : 0,
  };
}

const exchangeRate: WidgetDefinition = {
  name: 'exchange_rate',
  description: 'Display the exchange rate for a currency pair, with its recent history',
  params: [
    { name: 'base', type: 'string', required: true },
    { name: 'quote', type: 'string', required: true },
    { name: 'days', type: 'integer' },
  ],
  primaryMetric: (d) => ((d as { rate?: unknown })?.rate as number) ?? null,
  async fetchData(config) {
    const base = String(config.base ?? '').toLowerCase();
    const quote = String(config.quote ?? '').toLowerCase();
    if (!base || !quote) {
      throw new ServiceFetchError('market_data', 'exchange_rate', 'Both "base" and "quote" parameters are required');
    }
    const parsedDays = Number(config.days);
    const days = Number.isFinite(parsedDays) && parsedDays > 0 ? Math.min(parsedDays, 90) : DEFAULT_HISTORY_DAYS;

    if (FIAT_CODE.test(base) && FIAT_CODE.test(quote)) {
      const series = await fetchFiatSeries(base, quote, days);
      if (series) return summarize(base, quote, days, series, series[series.length - 1].price);
    }

    const url = `${BASE_URL}/simple/price?ids=${encodeURIComponent(base)}&vs_currencies=${encodeURIComponent(quote)}`;
    const data = await fetchJson(url, 'exchange_rate', PRICE_TTL_MS);
    const rate = data?.[base]?.[quote];
    if (rate === undefined) {
      throw new ServiceFetchError('market_data', 'exchange_rate', `No rate found for ${base}/${quote} (check the asset id)`);
    }

    // The history only feeds the chart — never fail the whole widget over it.
    let history: HistoryPoint[] = [];
    try {
      const chart = await fetchJson(
        `${BASE_URL}/coins/${encodeURIComponent(base)}/market_chart?vs_currency=${encodeURIComponent(quote)}&days=${days}`,
        'exchange_rate',
        HISTORY_TTL_MS,
      );
      if (Array.isArray(chart?.prices)) {
        history = chart.prices.map(([timestamp, price]: [number, number]) => ({
          timestamp: new Date(timestamp).toISOString(),
          price,
        }));
      }
    } catch {
      history = [];
    }
    return summarize(base, quote, days, history, rate);
  },
};

const priceHistory: WidgetDefinition = {
  name: 'price_history',
  description: 'Display the price history for an asset',
  params: [
    { name: 'asset', type: 'string', required: true },
    { name: 'days', type: 'integer' },
    { name: 'currency', type: 'string' },
  ],
  primaryMetric: (d) => {
    const last = Array.isArray(d) ? d[d.length - 1] : null;
    return typeof last?.price === 'number' ? last.price : null;
  },
  async fetchData(config) {
    const asset = String(config.asset ?? '').toLowerCase();
    if (!asset) {
      throw new ServiceFetchError('market_data', 'price_history', 'Missing required "asset" parameter');
    }
    const parsedDays = Number(config.days);
    const days = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7;
    const currency = String(config.currency ?? 'usd').toLowerCase();

    const url = `${BASE_URL}/coins/${encodeURIComponent(asset)}/market_chart?vs_currency=${encodeURIComponent(currency)}&days=${days}`;
    const data = await fetchJson(url, 'price_history', HISTORY_TTL_MS);
    const prices = data?.prices;
    if (!Array.isArray(prices)) {
      throw new ServiceFetchError('market_data', 'price_history', `No price history found for "${asset}" (check the asset id)`);
    }

    return prices.map(([timestamp, price]: [number, number]) => ({
      timestamp: new Date(timestamp).toISOString(),
      price,
    }));
  },
};

@Injectable()
export class MarketDataProvider implements ServiceProvider {
  name = 'market_data';
  requiresAuth = false;
  widgets: WidgetDefinition[] = [exchangeRate, priceHistory];
}
