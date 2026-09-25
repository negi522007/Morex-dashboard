import { CustomApiProvider } from './custom-api.provider';
import { ServiceFetchError } from '../service-provider.interface';

const json = (body: unknown) => jest.fn().mockResolvedValue({ ok: true, status: 200, url: 'x', contentType: 'application/json', text: JSON.stringify(body) }) as any;

describe('custom_api', () => {
  const p = new CustomApiProvider();
  const value = p.widgets.find((w) => w.name === 'json_value')!;
  const list = p.widgets.find((w) => w.name === 'json_list')!;

  it('json_value extracts a value, exposes it as the metric when numeric, and keeps the URL secret', async () => {
    p.fetcher = json({ data: { price: '12.5' } });
    const d: any = await value.fetchData({ url: 'https://api.test/x?key=k', path: 'data.price', label: 'Price', unit: '€' });
    expect(d).toMatchObject({ label: 'Price', unit: '€', value: '12.5' });
    expect(value.primaryMetric!(d)).toBe(12.5);
    expect(value.primaryMetric!({ value: 'abc' })).toBeNull();
    expect(value.params.find((x) => x.name === 'url')?.secret).toBe(true);
  });

  it('json_value fails clearly on a wrong path, bad JSON and HTTP errors', async () => {
    p.fetcher = json({ a: 1 });
    await expect(value.fetchData({ url: 'https://a.test', path: 'b' })).rejects.toThrow(/not found/);
    p.fetcher = jest.fn().mockResolvedValue({ ok: true, status: 200, text: '<html>' }) as any;
    await expect(value.fetchData({ url: 'https://a.test', path: 'b' })).rejects.toThrow(/valid JSON/);
    p.fetcher = jest.fn().mockResolvedValue({ ok: false, status: 500, text: '' }) as any;
    await expect(value.fetchData({ url: 'https://a.test', path: 'b' })).rejects.toBeInstanceOf(ServiceFetchError);
  });

  it('json_list maps title/subtitle fields and limits the count', async () => {
    p.fetcher = json({ items: [{ t: 'A', s: 1 }, { t: 'B', s: 2 }, { t: 'C' }] });
    const d: any = await list.fetchData({ url: 'https://a.test', path: 'items', titleField: 't', subtitleField: 's', number: 2 });
    expect(d.items).toEqual([{ title: 'A', subtitle: '1' }, { title: 'B', subtitle: '2' }]);
    await expect(list.fetchData({ url: 'https://a.test', path: 'nope', titleField: 't' })).rejects.toThrow(/not a list/);
  });

  it('refuses private targets with the real guard', async () => {
    const real = new CustomApiProvider();
    await expect(real.widgets[0].fetchData({ url: 'http://127.0.0.1:5432/', path: 'a' })).rejects.toBeInstanceOf(ServiceFetchError);
  });
});
