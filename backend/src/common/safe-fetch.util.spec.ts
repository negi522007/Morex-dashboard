import { UnsafeUrlError, createSafeFetcher, isPrivateAddress, parseUserUrl } from './safe-fetch.util';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1', '127.9.9.9', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1',
    '64:ff9b::7f00:1', '2002:7f00:0001::1', '2001:db8::1', 'not-an-ip',
  ])('treats %s as internal', (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111', '2a00:1450:4007::200e', '::ffff:8.8.8.8'])(
    'treats %s as public',
    (ip) => expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe('parseUserUrl', () => {
  it('rejects non-http schemes', () => {
    expect(() => parseUserUrl('file:///etc/passwd')).toThrow(UnsafeUrlError);
    expect(() => parseUserUrl('gopher://x')).toThrow(UnsafeUrlError);
    expect(() => parseUserUrl('ftp://x/y')).toThrow(UnsafeUrlError);
  });
  it('rejects embedded credentials and garbage', () => {
    expect(() => parseUserUrl('http://user:pw@example.com/')).toThrow(UnsafeUrlError);
    expect(() => parseUserUrl('not a url')).toThrow(UnsafeUrlError);
  });
});

describe('safeFetch', () => {
  const ok = (body = 'hello', headers: Record<string, string> = {}) => new Response(body, { status: 200, headers });
  const publicResolver = async () => ['93.184.216.34'];

  function fetcher(impl: (url: string) => Response | Promise<Response>, extra: object = {}) {
    const calls: string[] = [];
    const safe = createSafeFetcher({
      allowPrivate: false,
      resolver: publicResolver,
      fetchImpl: async (url) => {
        calls.push(url);
        return impl(url);
      },
      ...extra,
    });
    return { safe, calls };
  }

  it('fetches a public URL', async () => {
    const { safe, calls } = fetcher(() => ok('feed'));
    const res = await safe('https://example.com/feed.xml');
    expect(res).toMatchObject({ ok: true, status: 200, text: 'feed' });
    expect(calls).toEqual(['https://example.com/feed.xml']);
  });

  it.each([
    'http://127.0.0.1/', 'http://localhost/', 'http://db:5432/'.replace('db', '10.0.0.7'), 'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://2130706433/', 'http://0x7f.1/', 'http://foo.internal/', 'http://printer.local/',
  ])('blocks %s before any request is made', async (url) => {
    const { safe, calls } = fetcher(() => ok());
    await expect(safe(url)).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(calls).toHaveLength(0);
  });

  it('blocks a hostname that resolves to an internal address (DNS pointing inward)', async () => {
    const { safe, calls } = fetcher(() => ok(), { resolver: async () => ['10.1.2.3'] });
    await expect(safe('https://innocent.example.com/')).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(calls).toHaveLength(0);
  });

  it('blocks a hostname with ANY internal address among several', async () => {
    const { safe } = fetcher(() => ok(), { resolver: async () => ['93.184.216.34', '127.0.0.1'] });
    await expect(safe('https://mixed.example.com/')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('follows a redirect to another public URL', async () => {
    const { safe, calls } = fetcher((url) =>
      url.endsWith('/a') ? new Response(null, { status: 302, headers: { location: '/b' } }) : ok('final'),
    );
    expect((await safe('https://example.com/a')).text).toBe('final');
    expect(calls).toEqual(['https://example.com/a', 'https://example.com/b']);
  });

  it('refuses a redirect that points at an internal address', async () => {
    const { safe, calls } = fetcher(() => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }));
    await expect(safe('https://example.com/a')).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(calls).toEqual(['https://example.com/a']);
  });

  it('refuses a redirect to a non-http scheme', async () => {
    const { safe } = fetcher(() => new Response(null, { status: 302, headers: { location: 'file:///etc/passwd' } }));
    await expect(safe('https://example.com/a')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('gives up on redirect loops', async () => {
    const { safe } = fetcher(() => new Response(null, { status: 302, headers: { location: '/loop' } }));
    await expect(safe('https://example.com/loop', { maxRedirects: 3 })).rejects.toThrow(/Too many redirects/);
  });

  it('refuses a response above the size limit', async () => {
    const { safe } = fetcher(() => ok('x'.repeat(5000)));
    await expect(safe('https://example.com/big', { maxBytes: 1000 })).rejects.toThrow(/larger than/);
  });

  it('is bypassed only when private fetching is explicitly allowed (local dev)', async () => {
    const { safe } = fetcher(() => ok('local'), { allowPrivate: true });
    expect((await safe('http://127.0.0.1:9999/')).text).toBe('local');
  });
});
