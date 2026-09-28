import { searchAssets } from './assets.util';
import { marketCache } from './market-data.provider';

const currencies = { EUR: 'Euro', USD: 'United States Dollar', GBP: 'British Pound' };
const coins = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
  { id: 'wrapped-bitcoin', symbol: 'wbtc', name: 'Wrapped Bitcoin' },
];

beforeEach(() => {
  marketCache.clear();
  global.fetch = jest.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('frankfurter')) return { ok: true, json: async () => currencies } as any;
    if (u.includes('coins/list')) return { ok: true, json: async () => coins } as any;
    throw new Error('unexpected ' + u);
  }) as any;
});

describe('searchAssets', () => {
  it('matches a fiat currency by code prefix or name substring', async () => {
    expect(await searchAssets('eu', 'fiat')).toEqual([{ value: 'eur', label: 'EUR — Euro', kind: 'fiat' }]);
    expect(await searchAssets('dollar', 'fiat')).toEqual([{ value: 'usd', label: 'USD — United States Dollar', kind: 'fiat' }]);
  });

  it('ranks an exact crypto symbol match above a name/id substring match', async () => {
    const r = await searchAssets('bitcoin', 'crypto');
    expect(r[0]).toEqual({ value: 'bitcoin', label: 'Bitcoin (BTC)', kind: 'crypto' });
    expect(r.map((x) => x.value)).toContain('wrapped-bitcoin');
  });

  it('never scans the crypto list for an empty or 1-character query (kept cheap), but fiat still works', async () => {
    const fetchMock = global.fetch as jest.Mock;
    await searchAssets('', 'crypto');
    await searchAssets('b', 'crypto');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('coins/list'), expect.anything());
    expect(await searchAssets('', 'fiat')).toHaveLength(3);
  });

  it('"all" mixes both kinds, reserving only a few slots for fiat so crypto is not crowded out', async () => {
    const r = await searchAssets('bit', 'all', 10);
    expect(r.some((x) => x.kind === 'crypto')).toBe(true);
  });

  it('degrades to no results (not an error) when the upstream API is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down')) as any;
    expect(await searchAssets('eur', 'fiat')).toEqual([]);
    expect(await searchAssets('bitcoin', 'crypto')).toEqual([]);
  });

  it('caches the coin list so a second search does not refetch it', async () => {
    const fetchMock = global.fetch as jest.Mock;
    await searchAssets('bitcoin', 'crypto');
    const calls = fetchMock.mock.calls.length;
    await searchAssets('ethereum', 'crypto');
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
