import { CustomApiInspectController } from './custom-api-inspect.controller';

const ok = (body: unknown) => ({ ok: true, status: 200, url: 'https://a.test/x', contentType: 'application/json', text: JSON.stringify(body) });
const mockFetcher = (impl: any) => jest.fn(impl) as any;

describe('CustomApiInspectController', () => {
  const ctrl = new CustomApiInspectController();

  it('requires a url', async () => {
    await expect(ctrl.inspect(undefined)).rejects.toThrow(/url is required/);
  });

  it('inspects the response root for the "path" field (no path query param)', async () => {
    ctrl.fetcher = mockFetcher(async () => ok({ data: { price: 5, items: [{ name: 'a' }] } }));
    const r = await ctrl.inspect('https://a.test/x');
    expect(r.values.map((v) => v.path)).toContain('data.price');
    expect(r.lists.map((l) => l.path)).toContain('data.items');
  });

  it('with a chosen list path, proposes that item\'s own fields for titleField/subtitleField', async () => {
    ctrl.fetcher = mockFetcher(async () => ok({ items: [{ name: 'a', price: 1 }, { name: 'b', price: 2 }] }));
    const r = await ctrl.inspect('https://a.test/x', 'items');
    expect(r.values).toEqual([{ path: 'name', label: 'name', sample: 'a' }, { path: 'price', label: 'price', sample: '1' }]);
    expect(r.lists).toEqual([]);
  });

  it('filters by q on both values and lists', async () => {
    ctrl.fetcher = mockFetcher(async () => ok({ price: 5, priceHistory: [{ x: 1 }], name: 'x' }));
    const r = await ctrl.inspect('https://a.test/x', undefined, 'price');
    expect(r.values.map((v) => v.path)).toEqual(['price']);
    expect(r.lists.map((l) => l.path)).toEqual(['priceHistory']);
  });

  it('degrades to empty (not an error) on an unreachable URL, a non-2xx response or invalid JSON', async () => {
    ctrl.fetcher = mockFetcher(async () => { throw new Error('boom'); });
    expect(await ctrl.inspect('https://a.test/x')).toEqual({ root: 'scalar', values: [], lists: [] });
    ctrl.fetcher = mockFetcher(async () => ({ ok: false, status: 500, url: 'https://a.test/x', contentType: 'text/plain', text: 'no' }));
    expect(await ctrl.inspect('https://a.test/x')).toEqual({ root: 'scalar', values: [], lists: [] });
    ctrl.fetcher = mockFetcher(async () => ({ ok: true, status: 200, url: 'https://a.test/x', contentType: 'text/html', text: '<html>' }));
    expect(await ctrl.inspect('https://a.test/x')).toEqual({ root: 'scalar', values: [], lists: [] });
  });

  it('refuses a private-network URL through the real SSRF guard (uses the default fetcher, not the mock)', async () => {
    const real = new CustomApiInspectController();
    expect(await real.inspect('http://127.0.0.1:5432/')).toEqual({ root: 'scalar', values: [], lists: [] });
  });
});
