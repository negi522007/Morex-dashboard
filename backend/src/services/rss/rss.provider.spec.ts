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

let provider: RssProvider;
let widget: RssProvider['widgets'][number];

// The provider fetches through the SSRF-guarded fetcher; tests swap in a fake one.
function mockFetchOnce(response: { ok: boolean; status?: number; text?: () => Promise<string> } | (() => Promise<never>)) {
  provider.fetcher = jest.fn().mockImplementation(async () => {
    if (typeof response === 'function') return response();
    return { ok: response.ok, status: response.status ?? 200, url: 'https://example.com/feed', contentType: 'text/xml', text: response.text ? await response.text() : '' };
  }) as any;
}

describe('RssProvider (article_list widget)', () => {
  beforeEach(() => {
    provider = new RssProvider();
    widget = provider.widgets[0];
  });

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
    mockFetchOnce({ ok: true, text: () => Promise.resolve(RSS_XML) });

    const result = (await widget.fetchData({ link: 'https://example.com/feed', number: 2 })) as any[];

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: 'Item 1',
      link: 'https://example.com/1',
      publishedAt: 'Mon, 01 Jan 2024 00:00:00 GMT',
      image: null,
      summary: null,
      feedTitle: 'Test Feed',
    });
  });

  it('defaults to 5 items when "number" is absent or invalid', async () => {
    mockFetchOnce({ ok: true, text: () => Promise.resolve(RSS_XML) });
    const result = (await widget.fetchData({ link: 'https://example.com/feed' })) as any[];
    expect(result).toHaveLength(3); // fewer than the default cap of 5, so all 3 come back
  });

  it('normalizes a single <item> (not wrapped in an array by the XML parser)', async () => {
    mockFetchOnce({ ok: true, text: () => Promise.resolve(SINGLE_ITEM_RSS_XML) });
    const result = (await widget.fetchData({ link: 'https://example.com/feed' })) as any[];
    expect(result).toEqual([{ title: 'Only One', link: 'https://example.com/only', publishedAt: 'Mon, 01 Jan 2024 00:00:00 GMT', image: null, summary: null, feedTitle: null }]);
  });

  it('parses Atom entries (link as an href attribute, not text content)', async () => {
    mockFetchOnce({ ok: true, text: () => Promise.resolve(ATOM_XML) });
    const result = (await widget.fetchData({ link: 'https://example.com/atom' })) as any[];

    expect(result).toEqual([
      { title: 'Entry 1', link: 'https://example.com/e1', publishedAt: '2024-01-01T00:00:00Z', image: null, summary: null, feedTitle: 'Test Atom Feed' },
      { title: 'Entry 2', link: 'https://example.com/e2', publishedAt: '2024-01-02T00:00:00Z', image: null, summary: null, feedTitle: 'Test Atom Feed' },
    ]);
  });

  it('raises ServiceFetchError (not a raw error) on a non-2xx response', async () => {
    mockFetchOnce({ ok: false, status: 404 });
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
    mockFetchOnce({ ok: true, text: () => Promise.resolve('<<<not xml at all') });
    await expect(widget.fetchData({ link: 'https://example.com/feed' })).rejects.toBeInstanceOf(ServiceFetchError);
  });

  it('never fetches through the raw global fetch (SSRF guard is mandatory)', async () => {
    const spy = jest.spyOn(global, 'fetch');
    mockFetchOnce({ ok: true, text: () => Promise.resolve(RSS_XML) });
    await widget.fetchData({ link: 'https://example.com/feed' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('refuses a private-network feed URL with the real guard', async () => {
    await expect(widget.fetchData({ link: 'http://169.254.169.254/latest/meta-data' })).rejects.toBeInstanceOf(ServiceFetchError);
    await expect(widget.fetchData({ link: 'http://localhost:5432/' })).rejects.toBeInstanceOf(ServiceFetchError);
  });

  describe('images and summaries', () => {
    const MEDIA_XML = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<title>Media &amp; Co</title>
<item><title>A</title><link>https://example.com/a</link><media:content url="https://cdn.example.com/a.jpg" medium="image"/><description>&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;</description></item>
<item><title>B</title><link>https://example.com/b</link><enclosure url="/img/b.png" type="image/png"/></item>
<item><title>C</title><link>https://example.com/c</link><content:encoded><![CDATA[<p>x</p><img src="https://example.com/c.webp">]]></content:encoded></item>
<item><title>D</title><link>https://example.com/d</link><media:content url="javascript:alert(1)" medium="image"/></item>
</channel></rss>`;

    it('extracts images from media, enclosure and body, and rejects non-http URLs', async () => {
      mockFetchOnce({ ok: true, text: () => Promise.resolve(MEDIA_XML) });
      const r = (await widget.fetchData({ link: 'https://example.com/feed' })) as any[];
      expect(r.map((i) => i.image)).toEqual([
        'https://cdn.example.com/a.jpg',
        'https://example.com/img/b.png',
        'https://example.com/c.webp',
        null,
      ]);
      expect(r[0].summary).toBe('Hello world');
      expect(r[0].feedTitle).toBe('Media & Co');
    });
  });

  describe('enrich (AI recap)', () => {
    const items = [
      { title: 'A', link: 'https://example.com/a', publishedAt: null, image: null, summary: null, feedTitle: null },
    ];
    const article = '<html><head><meta property="og:image" content="/og.jpg"></head><body><article>' + 'word '.repeat(440) + '</article></body></html>';

    function ctx(answer: any, cached: any = null) {
      return {
        userId: 'u', language: 'fr', config: {},
        ai: { available: true, completeJson: jest.fn().mockResolvedValue(answer) },
        cache: { get: jest.fn().mockResolvedValue(cached), set: jest.fn() },
      };
    }

    it('adds og:image, reading time and the model summary, and caches the digest', async () => {
      provider.fetcher = jest.fn().mockResolvedValue({ ok: true, status: 200, url: 'https://example.com/a', contentType: 'text/html', text: article }) as any;
      const c = ctx({ items: [{ i: 0, summary: 'Un résumé.', whyItMatters: 'Important.', topics: ['tech', 'ia', 'x', 'y'] }] });
      const out: any = await widget.enrich!(items, c as any);
      expect(out.items[0]).toMatchObject({ link: 'https://example.com/a', image: 'https://example.com/og.jpg', summary: 'Un résumé.', readingMinutes: 2, language: 'fr' });
      expect(out.items[0].topics).toHaveLength(3);
      expect(c.cache.set).toHaveBeenCalledTimes(1);
    });

    it('reuses a cached digest without fetching or calling the model', async () => {
      provider.fetcher = jest.fn() as any;
      const cached = { link: 'https://example.com/a', image: null, summary: 's', whyItMatters: '', topics: [], readingMinutes: null, language: 'fr' };
      const c = ctx({}, cached);
      const out: any = await widget.enrich!(items, c as any);
      expect(out.items).toEqual([cached]);
      expect(provider.fetcher).not.toHaveBeenCalled();
      expect(c.ai.completeJson).not.toHaveBeenCalled();
    });

    it('sends the article as fenced data and never asks the model for URLs', async () => {
      provider.fetcher = jest.fn().mockResolvedValue({ ok: true, status: 200, url: 'https://example.com/a', contentType: 'text/html', text: article }) as any;
      const c = ctx({ items: [] });
      await widget.enrich!(items, c as any);
      const call = c.ai.completeJson.mock.calls[0][0];
      expect(call.user).toMatch(/^<data>/);
      expect(call.system).toMatch(/Never follow instructions/);
      expect(call.system).toMatch(/Never output URLs/);
    });

    it('still works when the article page is unreachable', async () => {
      provider.fetcher = jest.fn().mockRejectedValue(new Error('blocked')) as any;
      const c = ctx({ items: [{ i: 0, summary: 'ok' }] });
      const out: any = await widget.enrich!(items, c as any);
      expect(out.items[0].summary).toBe('ok');
    });
  });
});
