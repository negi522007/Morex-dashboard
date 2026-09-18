import { MarketDataProvider } from './market-data.provider';
import { ServiceFetchError } from '../service-provider.interface';

function mockFetchOnce(response: Partial<Response>) {
  global.fetch = jest.fn().mockResolvedValue(response) as any;
}

describe('MarketDataProvider', () => {
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
});
