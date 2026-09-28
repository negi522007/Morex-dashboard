import { MarketDataProvider, marketCache } from './market-data.provider';
import { ServiceFetchError } from '../service-provider.interface';

function mockFetchOnce(response: Partial<Response>) {
  global.fetch = jest.fn().mockResolvedValue(response) as any;
}

describe('MarketDataProvider', () => {
  beforeEach(() => marketCache.clear());

  const provider = new MarketDataProvider();
  const exchangeRate = provider.widgets.find((w) => w.name === 'exchange_rate')!;
  const priceHistory = provider.widgets.find((w) => w.name === 'price_history')!;

  it('exposes the contract expected by /about.json', () => {
    expect(provider.name).toBe('market_data');
    expect(provider.requiresAuth).toBe(false);
    expect(provider.widgets.map((w) => w.name).sort()).toEqual(['exchange_rate', 'price_history']);
  });

  describe('exchange_rate', () => {
    it('rejects when base or quote is missing', async () => {
      await expect(exchangeRate.fetchData({ base: 'bitcoin' })).rejects.toBeInstanceOf(ServiceFetchError);
      await expect(exchangeRate.fetchData({ quote: 'usd' })).rejects.toBeInstanceOf(ServiceFetchError);
    });

    it('uses ECB history for a fiat pair and derives min/max/change from it', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({ rates: { '2026-09-22': { USD: 1.1 }, '2026-09-23': { USD: 1.2 }, '2026-09-24': { USD: 1.15 } } }),
      }) as any;
      const result = (await exchangeRate.fetchData({ base: 'eur', quote: 'usd' })) as any;
      expect(result.rate).toBe(1.15);
      expect(result.history).toHaveLength(3);
      expect(result.min).toBe(1.1);
      expect(result.max).toBe(1.2);
      expect(result.changePct).toBeCloseTo(4.545, 2);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('frankfurter');
    });

    it('falls back to CoinGecko when a 3-letter pair is not a fiat pair', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ status: 404, ok: false })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ eos: { usd: 0.7 } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ prices: [[1_700_000_000_000, 0.6], [1_700_086_400_000, 0.7]] }) }) as any;
      const result = (await exchangeRate.fetchData({ base: 'eos', quote: 'usd' })) as any;
      expect(result.rate).toBe(0.7);
      expect(result.history).toHaveLength(2);
    });

    it('still returns the rate when only the history request fails', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ bitcoin: { usd: 76340 } }) })
        .mockResolvedValueOnce({ ok: false, status: 429 }) as any;
      const result = (await exchangeRate.fetchData({ base: 'bitcoin', quote: 'usd' })) as any;
      expect(result.rate).toBe(76340);
      expect(result.history).toEqual([]);
    });

    it('returns the rate for a known pair', async () => {
      mockFetchOnce({ ok: true, json: () => Promise.resolve({ bitcoin: { usd: 76340 } }) });
      const result = (await exchangeRate.fetchData({ base: 'bitcoin', quote: 'usd' })) as any;
      expect(result).toEqual(expect.objectContaining({ base: 'bitcoin', quote: 'usd', rate: 76340 }));
    });

    it('raises ServiceFetchError when the API responds but the pair is unknown (empty object, still 200)', async () => {
      mockFetchOnce({ ok: true, json: () => Promise.resolve({}) });
      await expect(exchangeRate.fetchData({ base: 'not-a-coin', quote: 'usd' })).rejects.toThrow(
        /No rate found for not-a-coin\/usd/,
      );
    });

    it('raises ServiceFetchError on a non-2xx response', async () => {
      mockFetchOnce({ ok: false, status: 429 });
      await expect(exchangeRate.fetchData({ base: 'bitcoin', quote: 'usd' })).rejects.toBeInstanceOf(
        ServiceFetchError,
      );
    });
  });

  describe('price_history', () => {
    it('rejects when asset is missing', async () => {
      await expect(priceHistory.fetchData({})).rejects.toBeInstanceOf(ServiceFetchError);
    });

    it('maps [timestamp, price] pairs into objects and defaults days to 7', async () => {
      mockFetchOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            prices: [
              [1700000000000, 100.5],
              [1700003600000, 101.2],
            ],
          }),
      });

      const result = (await priceHistory.fetchData({ asset: 'ethereum' })) as any[];
      expect(result).toEqual([
        { timestamp: new Date(1700000000000).toISOString(), price: 100.5 },
        { timestamp: new Date(1700003600000).toISOString(), price: 101.2 },
      ]);
    });

    it('raises ServiceFetchError when the response has no usable "prices" array', async () => {
      mockFetchOnce({ ok: true, json: () => Promise.resolve({ error: 'coin not found' }) });
      await expect(priceHistory.fetchData({ asset: 'not-a-coin' })).rejects.toThrow(
        /No price history found for "not-a-coin"/,
      );
    });
  });

  describe('rate limiting (CoinGecko free tier answers 429)', () => {
    it('does not call the API twice for the same request', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ prices: [[1, 10], [2, 11]] }) }) as any;
      await priceHistory.fetchData({ asset: 'bitcoin', days: 30, currency: 'usd' });
      await priceHistory.fetchData({ asset: 'bitcoin', days: 30, currency: 'usd' });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('shares one history request between an exchange-rate and a price-history widget on the same coin', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) =>
        Promise.resolve(
          String(url).includes('simple/price')
            ? { ok: true, json: () => Promise.resolve({ bitcoin: { usd: 5 } }) }
            : { ok: true, json: () => Promise.resolve({ prices: [[1, 4], [2, 5]] }) },
        ),
      ) as any;
      await exchangeRate.fetchData({ base: 'bitcoin', quote: 'usd', days: 30 });
      await priceHistory.fetchData({ asset: 'bitcoin', days: 30, currency: 'usd' });
      const historyCalls = (global.fetch as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('market_chart'));
      expect(historyCalls).toHaveLength(1);
    });
  });


  describe('self-healing a free-typed crypto name', () => {
    // A widget saved with "Ether" (a display name) instead of the CoinGecko id "ethereum" — the id an
    // autocomplete pick would have given. Both widgets should resolve it once and retry, so the widget
    // works on the very next refresh with no need to re-save the config.
    const router = (map: Record<string, any>) =>
      jest.fn().mockImplementation((url: string) => {
        const u = String(url);
        for (const [frag, body] of Object.entries(map)) if (u.includes(frag)) return Promise.resolve(typeof body === 'function' ? body() : body);
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      });
    const coinsList = { ok: true, json: () => Promise.resolve([{ id: 'ethereum', symbol: 'eth', name: 'Ether' }, { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }]) };

    it('price_history: retries once with the resolved id after CoinGecko 404s the unknown one, and gives up cleanly if nothing matches', async () => {
      global.fetch = router({
        'coins/list': coinsList,
        'coins/ethereum/market_chart': { ok: true, json: () => Promise.resolve({ prices: [[1, 4]] }) },
        // Unmatched fragments (the initial "ether" attempt) fall through to the router's 404 default,
        // matching CoinGecko's real behaviour for an id it doesn't know.
      });
      const result = (await priceHistory.fetchData({ asset: 'Ether', currency: 'usd' })) as any;
      expect(result).toEqual([{ timestamp: new Date(1).toISOString(), price: 4 }]);
      const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('coins/ether/market_chart'))).toBe(true); // the failed first attempt
      expect(urls.some((u) => u.includes('coins/ethereum/market_chart'))).toBe(true); // the resolved retry

      global.fetch = router({ 'coins/list': coinsList });
      await expect(priceHistory.fetchData({ asset: 'not-a-real-coin-xyz', currency: 'usd' })).rejects.toThrow(/check the asset id/);
    });

    it('exchange_rate: same self-healing on the crypto leg, without touching a fiat/fiat pair', async () => {
      global.fetch = router({
        'coins/list': coinsList,
        // CoinGecko's simple/price silently omits an id it doesn't know (200, no matching key) rather than 404ing.
        'simple/price?ids=ether&': { ok: true, json: () => Promise.resolve({}) },
        'simple/price?ids=ethereum': { ok: true, json: () => Promise.resolve({ ethereum: { usd: 3000 } }) },
        'coins/ethereum/market_chart': { ok: true, json: () => Promise.resolve({ prices: [[1, 2999]] }) },
      });
      const result = (await exchangeRate.fetchData({ base: 'Ether', quote: 'usd', days: 7 })) as any;
      expect(result.rate).toBe(3000);
      expect(result.base).toBe('ethereum');
    });
  });
});
