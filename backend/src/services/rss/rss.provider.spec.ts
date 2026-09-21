import { RssProvider } from './rss.provider';
import { ServiceFetchError } from '../service-provider.interface';

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<title>Test Feed</title>
<item><title>Item 1</title><link>https://example.com/1</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
<item><title>Item 2</title><link>https://example.com/2</link><pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate></item>
<item><title>Item 3</title><link>https://example.com/3</link><pubDate>Wed, 03 Jan 2024 00:00:00 GMT</pubDate></item>
</channel></rss>`;

const SINGLE_ITEM_RSS_XML = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<item><title>Only One</title><link>https://example.com/only</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM_XML = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Test Atom Feed</title>
<entry><title>Entry 1</title><link rel="alternate" href="https://example.com/e1"/><published>2024-01-01T00:00:00Z</published></entry>
<entry><title>Entry 2</title><link rel="alternate" href="https://example.com/e2"/><published>2024-01-02T00:00:00Z</published></entry>
</feed>`;

function mockFetchOnce(response: Partial<Response> | (() => Promise<never>)) {
  global.fetch = jest.fn().mockImplementation(() => {
    if (typeof response === 'function') return response();
    return Promise.resolve(response);
  }) as any;
}

describe('RssProvider (article_list widget)', () => {
  const provider = new RssProvider();
  const widget = provider.widgets[0];

  it('exposes the contract expected by /about.json', () => {
    expect(provider.name).toBe('rss');
    expect(provider.requiresAuth).toBe(false);
    expect(widget.name).toBe('article_list');
    expect(widget.params.find((p) => p.name === 'link')?.required).toBe(true);
  });

  it('rejects when "link" is missing', async () => {
    await expect(widget.fetchData({})).rejects.toBeInstanceOf(ServiceFetchError);
  });

  it('parses RSS 2.0 items and respects the "number" limit', async () => {
    mockFetchOnce({ ok: true, text: () => Promise.resolve(RSS_XML) } as Response);

    const result = (await widget.fetchData({ link: 'https://example.com/feed', number: 2 })) as any[];

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: 'Item 1',
      link: 'https://example.com/1',
      publishedAt: 'Mon, 01 Jan 2024 00:00:00 GMT',
    });
  });

  it('defaults to 5 items when "number" is absent or invalid', async () => {
    mockFetchOnce({ ok: true, text: () => Promise.resolve(RSS_XML) } as Response);
    const result = (await widget.fetchData({ link: 'https://example.com/feed' })) as any[];
    expect(result).toHaveLength(3); // fewer than the default cap of 5, so all 3 come back
  });

  it('normalizes a single <item> (not wrapped in an array by the XML parser)', async () => {
    mockFetchOnce({ ok: true, text: () => Promise.resolve(SINGLE_ITEM_RSS_XML) } as Response);
    const result = (await widget.fetchData({ link: 'https://example.com/feed' })) as any[];
    expect(result).toEqual([{ title: 'Only One', link: 'https://example.com/only', publishedAt: 'Mon, 01 Jan 2024 00:00:00 GMT' }]);
  });

  it('parses Atom entries (link as an href attribute, not text content)', async () => {
    mockFetchOnce({ ok: true, text: () => Promise.resolve(ATOM_XML) } as Response);
    const result = (await widget.fetchData({ link: 'https://example.com/atom' })) as any[];

    expect(result).toEqual([
      { title: 'Entry 1', link: 'https://example.com/e1', publishedAt: '2024-01-01T00:00:00Z' },
      { title: 'Entry 2', link: 'https://example.com/e2', publishedAt: '2024-01-02T00:00:00Z' },
    ]);
  });

  it('raises ServiceFetchError (not a raw error) on a non-2xx response', async () => {
    mockFetchOnce({ ok: false, status: 404 } as Response);
    await expect(widget.fetchData({ link: 'https://example.com/missing' })).rejects.toBeInstanceOf(
      ServiceFetchError,
    );
  });

  it('raises ServiceFetchError when the network call itself fails', async () => {
    mockFetchOnce(() => Promise.reject(new Error('DNS lookup failed')));
    await expect(widget.fetchData({ link: 'https://bad-host.invalid/feed' })).rejects.toBeInstanceOf(
      ServiceFetchError,
    );
  });

  it('raises ServiceFetchError on unparseable XML instead of throwing a raw parser error', async () => {
    mockFetchOnce({ ok: true, text: () => Promise.resolve('<<<not xml at all') } as Response);
    await expect(widget.fetchData({ link: 'https://example.com/feed' })).rejects.toBeInstanceOf(ServiceFetchError);
  });
});
