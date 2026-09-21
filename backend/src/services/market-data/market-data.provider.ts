import { Injectable } from '@nestjs/common';
import { ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

const FETCH_TIMEOUT_MS = 10_000;
const BASE_URL = 'https://api.coingecko.com/api/v3';

async function fetchJson(url: string, widgetName: string): Promise<any> {
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

const exchangeRate: WidgetDefinition = {
  name: 'exchange_rate',
  description: 'Display the exchange rate for a currency pair',
  params: [
    { name: 'base', type: 'string', required: true },
    { name: 'quote', type: 'string', required: true },
  ],
  async fetchData(config) {
    const base = String(config.base ?? '').toLowerCase();
    const quote = String(config.quote ?? '').toLowerCase();
    if (!base || !quote) {
      throw new ServiceFetchError('market_data', 'exchange_rate', 'Both "base" and "quote" parameters are required');
    }

    const url = `${BASE_URL}/simple/price?ids=${encodeURIComponent(base)}&vs_currencies=${encodeURIComponent(quote)}`;
    const data = await fetchJson(url, 'exchange_rate');
    const rate = data?.[base]?.[quote];
    if (rate === undefined) {
      throw new ServiceFetchError('market_data', 'exchange_rate', `No rate found for ${base}/${quote} (check the asset id)`);
    }

    return { base, quote, rate, asOf: new Date().toISOString() };
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
  async fetchData(config) {
    const asset = String(config.asset ?? '').toLowerCase();
    if (!asset) {
      throw new ServiceFetchError('market_data', 'price_history', 'Missing required "asset" parameter');
    }
    const parsedDays = Number(config.days);
    const days = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7;
    const currency = String(config.currency ?? 'usd').toLowerCase();

    const url = `${BASE_URL}/coins/${encodeURIComponent(asset)}/market_chart?vs_currency=${encodeURIComponent(currency)}&days=${days}`;
    const data = await fetchJson(url, 'price_history');
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
